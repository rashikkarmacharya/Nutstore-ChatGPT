import { createClient, type FileStat } from "webdav";
import type { SupportedFileType } from "officeparser";

const MAX_SEARCHABLE_DOCUMENT_BYTES = 12 * 1024 * 1024;
const MAX_SEARCH_ENTRIES = 5000;
const MAX_SEARCH_DEPTH = 10;
const TEXT_EXTENSIONS = new Set(["txt", "text", "log", "json", "xml", "yaml", "yml", "csv", "md", "html", "htm"]);
const OFFICE_FILE_TYPES: Record<string, string> = {
  pdf: "pdf",
  docx: "docx",
  xlsx: "xlsx",
  pptx: "pptx",
  odt: "odt",
  ods: "ods",
  odp: "odp",
  odg: "odg",
  rtf: "rtf",
  epub: "epub"
};

function boundedInteger(value: number, fallback: number, min: number, max: number): number {
  const integer = Number.isFinite(value) ? Math.trunc(value) : fallback;
  return Math.min(Math.max(integer, min), max);
}

export type NutstoreEntry = {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  modified: string | null;
};

export type NutstoreSearchMatch = NutstoreEntry & {
  matchType: "name" | "content";
  snippet?: string;
};

export type NutstoreSearchResult = {
  query: string;
  path: string;
  matches: NutstoreSearchMatch[];
  entriesVisited: number;
  documentsScanned: number;
  documentsSkipped: number;
  contentSearchLimitReached: boolean;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured in Vercel`);
  return value;
}

function client() {
  const baseUrl = (process.env.NUTSTORE_WEBDAV_URL || "https://dav.jianguoyun.com/dav/").trim();
  return createClient(baseUrl, {
    username: requiredEnv("NUTSTORE_USERNAME"),
    password: requiredEnv("NUTSTORE_APP_PASSWORD")
  });
}

export function normalizePath(input = "/"): string {
  const decoded = input.replaceAll("\\", "/").trim();
  if (!decoded.startsWith("/")) throw new Error("Paths must start with '/'");
  if (decoded.split("/").some((part) => part === "..")) throw new Error("Parent-directory segments are not allowed");
  const normalized = `/${decoded.split("/").filter(Boolean).join("/")}`;
  return normalized === "" ? "/" : normalized;
}

function toEntry(item: FileStat): NutstoreEntry {
  const path = normalizePath(item.filename);
  return {
    name: item.basename || path.split("/").at(-1) || path,
    path,
    type: item.type === "directory" ? "directory" : "file",
    size: Number(item.size || 0),
    modified: item.lastmod || null
  };
}

export async function listDirectory(inputPath = "/"): Promise<NutstoreEntry[]> {
  const path = normalizePath(inputPath);
  const entries = await client().getDirectoryContents(path);
  if (!Array.isArray(entries)) throw new Error("Nutstore returned an unexpected directory response");
  return entries.map(toEntry).filter((entry) => entry.path !== path);
}

export async function searchFiles(query: string, inputPath = "/", limit = 50, requestedMaxFilesToScan = 40): Promise<NutstoreSearchResult> {
  const needle = query.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  if (!needle) throw new Error("query must not be empty");
  const root = normalizePath(inputPath);
  const maxResults = boundedInteger(limit, 50, 1, 100);
  const maxFilesToScan = boundedInteger(requestedMaxFilesToScan, 40, 1, 100);
  const results: NutstoreSearchMatch[] = [];
  const queue: Array<{ path: string; depth: number }> = [{ path: root, depth: 0 }];
  const visited = new Set<string>();
  let visitedEntries = 0;
  let documentsScanned = 0;
  let documentsSkipped = 0;
  let contentSearchLimitReached = false;

  while (queue.length && results.length < maxResults && visitedEntries < MAX_SEARCH_ENTRIES) {
    const current = queue.shift()!;
    if (visited.has(current.path) || current.depth > MAX_SEARCH_DEPTH) continue;
    visited.add(current.path);
    const entries = await listDirectory(current.path);
    for (const entry of entries) {
      visitedEntries++;
      const nameMatches = `${entry.name} ${entry.path}`.toLocaleLowerCase().includes(needle);
      if (nameMatches) {
        results.push({ ...entry, matchType: "name" });
        if (results.length >= maxResults) break;
      }
      if (entry.type === "directory" && current.depth < MAX_SEARCH_DEPTH) queue.push({ path: entry.path, depth: current.depth + 1 });

      if (entry.type === "file" && !nameMatches) {
        const extension = entry.name.split(".").at(-1)?.toLocaleLowerCase() || "";
        const isOffice = Object.hasOwn(OFFICE_FILE_TYPES, extension);
        const isPlainText = TEXT_EXTENSIONS.has(extension);
        if (isOffice || isPlainText) {
          if (documentsScanned >= maxFilesToScan) {
            contentSearchLimitReached = true;
            break;
          }
          if (entry.size > MAX_SEARCHABLE_DOCUMENT_BYTES) {
            documentsSkipped++;
            continue;
          }
          documentsScanned++;
          try {
            const downloaded = await client().getFileContents(entry.path, { format: "binary" });
            const bytes = downloaded instanceof ArrayBuffer ? Buffer.from(downloaded) : Buffer.from(downloaded as Uint8Array);
            if (bytes.byteLength > MAX_SEARCHABLE_DOCUMENT_BYTES) {
              documentsSkipped++;
              continue;
            }
            let text: string;
            if (isPlainText) {
              text = bytes.toString("utf8");
            } else {
              const { OfficeParser } = await import("officeparser");
              const ast = await OfficeParser.parseOffice(bytes, { fileType: OFFICE_FILE_TYPES[extension] as SupportedFileType });
              text = ast.toText();
            }
            const normalizedText = text.replace(/\s+/g, " ");
            const matchIndex = normalizedText.toLocaleLowerCase().indexOf(needle);
            if (matchIndex >= 0) {
              const start = Math.max(0, matchIndex - 90);
              const end = Math.min(normalizedText.length, matchIndex + needle.length + 150);
              results.push({ ...entry, matchType: "content", snippet: normalizedText.slice(start, end) });
              if (results.length >= maxResults) break;
            }
          } catch {
            // An unreadable, encrypted, or malformed file should not abort the whole search.
            documentsSkipped++;
          }
        }
      }
      if (visitedEntries >= MAX_SEARCH_ENTRIES) break;
    }
    if (contentSearchLimitReached) break;
  }
  return {
    query: query.trim(),
    path: root,
    matches: results,
    entriesVisited: visitedEntries,
    documentsScanned,
    documentsSkipped,
    contentSearchLimitReached: contentSearchLimitReached || visitedEntries >= MAX_SEARCH_ENTRIES
  };
}

export async function readTextFile(inputPath: string, maxChars = 100_000): Promise<{ path: string; text: string; truncated: boolean }> {
  const path = normalizePath(inputPath);
  const content = await client().getFileContents(path, { format: "text" });
  const text = typeof content === "string" ? content : Buffer.from(content as ArrayBuffer).toString("utf8");
  return { path, text: text.slice(0, maxChars), truncated: text.length > maxChars };
}

export async function uploadTextFile(inputPath: string, content: string, overwrite = false): Promise<{ path: string; bytes: number }> {
  const path = normalizePath(inputPath);
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > 3_000_000) throw new Error("Text uploads are limited to 3 MB per request");
  await client().putFileContents(path, content, { overwrite });
  return { path, bytes };
}

export async function createFolder(inputPath: string): Promise<{ path: string }> {
  const path = normalizePath(inputPath);
  if (path === "/") return { path };
  await client().createDirectory(path);
  return { path };
}

export async function moveEntry(sourceInput: string, destinationInput: string): Promise<{ source: string; destination: string }> {
  const source = normalizePath(sourceInput);
  const destination = normalizePath(destinationInput);
  if (source === "/" || destination === "/") throw new Error("Root cannot be moved");
  await client().moveFile(source, destination);
  return { source, destination };
}

export async function copyEntry(sourceInput: string, destinationInput: string): Promise<{ source: string; destination: string }> {
  const source = normalizePath(sourceInput);
  const destination = normalizePath(destinationInput);
  if (source === "/" || destination === "/") throw new Error("Root cannot be copied");
  await client().copyFile(source, destination);
  return { source, destination };
}
