import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { copyEntry, createFolder, listDirectory, moveEntry, readTextFile, searchFiles, uploadTextFile } from "../../../lib/nutstore";
import { isAuthorized, unauthorized } from "../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const handler = createMcpHandler((server) => {
  server.registerTool("nutstore_list_directory", {
    description: "List files and folders in a Nutstore directory. Paths start with '/'.",
    inputSchema: z.object({ path: z.string().optional() })
  }, async ({ path }) => ({
    content: [{ type: "text", text: JSON.stringify(await listDirectory(path || "/"), null, 2) }]
  }));

  server.registerTool("nutstore_search_files", {
    description: "Search Nutstore names and text inside supported PDF, Word, Excel, PowerPoint, OpenDocument, and text files. Content scanning is on demand and limited to 40 documents by default (up to 100). Scanned image-only PDFs and legacy .doc/.xls/.ppt files are not supported.",
    inputSchema: z.object({ query: z.string().min(1), path: z.string().optional(), limit: z.number().int().min(1).max(100).optional(), max_files_to_scan: z.number().int().min(1).max(100).optional() })
  }, async ({ query, path, limit, max_files_to_scan }) => ({
    content: [{ type: "text", text: JSON.stringify(await searchFiles(query, path || "/", limit || 50, max_files_to_scan || 40), null, 2) }]
  }));

  server.registerTool("nutstore_read_text_file", {
    description: "Read a UTF-8 text file from Nutstore. For now this supports text-based formats such as TXT, CSV, MD, JSON, XML and HTML.",
    inputSchema: z.object({ path: z.string().min(1) })
  }, async ({ path }) => ({
    content: [{ type: "text", text: JSON.stringify(await readTextFile(path), null, 2) }]
  }));

  server.registerTool("nutstore_upload_text_file", {
    description: "Upload a UTF-8 text file to Nutstore. Existing files are not overwritten unless overwrite is true.",
    inputSchema: z.object({ path: z.string().min(1), content: z.string(), overwrite: z.boolean().optional() })
  }, async ({ path, content, overwrite }) => ({
    content: [{ type: "text", text: JSON.stringify(await uploadTextFile(path, content, overwrite || false), null, 2) }]
  }));

  server.registerTool("nutstore_create_folder", {
    description: "Create a Nutstore folder at the specified path.",
    inputSchema: z.object({ path: z.string().min(1) })
  }, async ({ path }) => ({
    content: [{ type: "text", text: JSON.stringify(await createFolder(path), null, 2) }]
  }));

  server.registerTool("nutstore_move", {
    description: "Move a Nutstore file or folder to another path.",
    inputSchema: z.object({ source: z.string().min(1), destination: z.string().min(1) })
  }, async ({ source, destination }) => ({
    content: [{ type: "text", text: JSON.stringify(await moveEntry(source, destination), null, 2) }]
  }));

  server.registerTool("nutstore_copy", {
    description: "Copy a Nutstore file or folder to another path.",
    inputSchema: z.object({ source: z.string().min(1), destination: z.string().min(1) })
  }, async ({ source, destination }) => ({
    content: [{ type: "text", text: JSON.stringify(await copyEntry(source, destination), null, 2) }]
  }));
});

async function authorized(request: Request): Promise<Response> {
  try {
    if (!isAuthorized(request)) return unauthorized();
    return await handler(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

export { authorized as GET, authorized as POST };
