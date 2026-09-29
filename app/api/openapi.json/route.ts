export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return Response.json({
    openapi: "3.1.0",
    info: {
      title: "Nutstore Connector",
      version: "0.1.0",
      description: "Search, list, read text files, upload text files, create folders, move and copy files in Nutstore. Search currently matches file and folder names/paths."
    },
    servers: [{ url: origin }],
    security: [{ BearerAuth: [] }],
    paths: {
      "/api/actions/list": {
        get: { operationId: "listNutstoreDirectory", summary: "List Nutstore folder contents", parameters: [{ name: "path", in: "query", required: false, schema: { type: "string", default: "/" } }], responses: { "200": { description: "Folder entries" } } }
      },
      "/api/actions/search": {
        get: { operationId: "searchNutstoreFiles", summary: "Search file and folder names recursively", parameters: [{ name: "query", in: "query", required: true, schema: { type: "string" } }, { name: "path", in: "query", required: false, schema: { type: "string", default: "/" } }, { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } }], responses: { "200": { description: "Matching entries" } } }
      },
      "/api/actions/read-text": {
        get: { operationId: "readNutstoreTextFile", summary: "Read a UTF-8 text file", parameters: [{ name: "path", in: "query", required: true, schema: { type: "string" } }], responses: { "200": { description: "Text file contents" } } }
      },
      "/api/actions/upload-text": {
        post: { operationId: "uploadNutstoreTextFile", summary: "Upload a UTF-8 text file", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["path", "content"], properties: { path: { type: "string" }, content: { type: "string" }, overwrite: { type: "boolean", default: false } } } } } }, responses: { "200": { description: "Upload result" } } }
      },
      "/api/actions/create-folder": {
        post: { operationId: "createNutstoreFolder", summary: "Create a folder", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["path"], properties: { path: { type: "string" } } } } } }, responses: { "200": { description: "Created folder" } } }
      },
      "/api/actions/move": {
        post: { operationId: "moveNutstoreEntry", summary: "Move a file or folder", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["source", "destination"], properties: { source: { type: "string" }, destination: { type: "string" } } } } } }, responses: { "200": { description: "Move result" } } }
      },
      "/api/actions/copy": {
        post: { operationId: "copyNutstoreEntry", summary: "Copy a file or folder", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["source", "destination"], properties: { source: { type: "string" }, destination: { type: "string" } } } } } }, responses: { "200": { description: "Copy result" } } }
      }
    },
    components: { securitySchemes: { BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "API token" } } }
  });
}
