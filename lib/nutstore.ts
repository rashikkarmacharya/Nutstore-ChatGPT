import { createClient, type FileStat } from "webdav";

export type NutstoreEntry = {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  modified: string | null;
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

export async function searchFiles(query: string, inputPath = "/", limit = 50): Promise<NutstoreEntry[]> {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) throw new Error("query must not be empty");
  const root = normalizePath(inputPath);
  const maxResults = Math.min(Math.max(Math.trunc(limit || 50), 1), 100);
  const results: NutstoreEntry[] = [];
  const queue: Array<{ path: string; depth: number }> = [{ path: root, depth: 0 }];
  const visited = new Set<string>();
  let visitedEntries = 0;

  while (queue.length && results.length < maxResults && visitedEntries < 5000) {
    const current = queue.shift()!;
    if (visited.has(current.path) || current.depth > 10) continue;
    visited.add(current.path);
    const entries = await listDirectory(current.path);
    for (const entry of entries) {
      visitedEntries++;
      if (entry.name.toLocaleLowerCase().includes(needle) || entry.path.toLocaleLowerCase().includes(needle)) {
        results.push(entry);
        if (results.length >= maxResults) break;
      }
      if (entry.type === "directory" && current.depth < 10) queue.push({ path: entry.path, depth: current.depth + 1 });
      if (visitedEntries >= 5000) break;
    }
  }
  return results;
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
