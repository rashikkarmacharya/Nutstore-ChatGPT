import { copyEntry, createFolder, listDirectory, moveEntry, readTextFile, searchFiles, uploadTextFile } from "../../../../lib/nutstore";
import { isAuthorized, unauthorized } from "../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Context = { params: Promise<{ operation: string }> };

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Request failed";
  return /password|authorization|bearer|token/i.test(message) ? "Nutstore request failed; check Vercel environment variables and Nutstore credentials" : message;
}

async function run(request: Request, context: Context): Promise<Response> {
  try {
    if (!isAuthorized(request)) return unauthorized();
    const { operation } = await context.params;
    const url = new URL(request.url);
    const body = request.method === "GET" ? {} : await request.json().catch(() => ({}));
    let data: unknown;

    switch (operation) {
      case "list":
        data = await listDirectory(url.searchParams.get("path") || "/");
        break;
      case "search": {
        const query = url.searchParams.get("query") || "";
        const path = url.searchParams.get("path") || "/";
        const limit = Number(url.searchParams.get("limit") || 50);
        const maxFilesToScan = Number(url.searchParams.get("max_files_to_scan") || 40);
        data = await searchFiles(query, path, limit, maxFilesToScan);
        break;
      }
      case "read-text":
        data = await readTextFile(url.searchParams.get("path") || "");
        break;
      case "upload-text":
        data = await uploadTextFile(String(body.path || ""), String(body.content || ""), Boolean(body.overwrite));
        break;
      case "create-folder":
        data = await createFolder(String(body.path || ""));
        break;
      case "move":
        data = await moveEntry(String(body.source || ""), String(body.destination || ""));
        break;
      case "copy":
        data = await copyEntry(String(body.source || ""), String(body.destination || ""));
        break;
      default:
        return Response.json({ error: "Unknown operation" }, { status: 404 });
    }
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: safeError(error) }, { status: 400 });
  }
}

export const GET = run;
export const POST = run;
