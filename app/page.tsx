export default function Home() {
  return (
    <main>
      <h1>Nutstore ChatGPT Connector</h1>
      <p>The connector service is running. Connect an MCP client to <code>/api/mcp</code>.</p>
      <p>For a ChatGPT custom GPT Action, import the OpenAPI schema at <code>/api/openapi.json</code>.</p>
      <p>Both endpoints require the Bearer token configured as <code>NUTSTORE_API_TOKEN</code>.</p>
    </main>
  );
}
