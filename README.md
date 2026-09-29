# Nutstore ChatGPT Connector

A Vercel-hosted connector that accesses Nutstore through its WebDAV interface. It exposes the same tools in two forms:

- Streamable HTTP MCP at `/api/mcp`.
- An OpenAPI 3.1 REST API at `/api/actions/*`, with its schema served from `/api/openapi.json` for a custom GPT Action.

The server uses one Nutstore account, configured by the project owner in Vercel. It never puts credentials in the repository or returns them from any endpoint.

## Current operations

- List directory contents.
- Search file and folder names recursively (not document contents).
- Read UTF-8 text files.
- Upload UTF-8 text files, without overwriting by default.
- Create a folder, move an entry, or copy an entry.

This first version does not implement PDF/Office text extraction, shared links, revision history, or delete. Add those only after testing Nutstore's WebDAV behavior and deciding the required recovery/permission controls.

## Deploy to Vercel

1. Push this project to the `main` branch of the public `Nutstore-ChatGPT` repository.
2. In Vercel, import that repository. Use **Root Directory** `./`; the framework should be detected as **Next.js**. Leave Build and Output Settings at their defaults.
3. Add the environment variables below in Vercel. Do not commit `.env.local` or real values.
4. Deploy and wait for the build to succeed.
5. Check `https://YOUR-VERCEL-DOMAIN/` and `https://YOUR-VERCEL-DOMAIN/api/openapi.json`.

## Vercel environment variables

| Key | Value |
|---|---|
| `NUTSTORE_USERNAME` | The email address used for the Nutstore account. |
| `NUTSTORE_APP_PASSWORD` | A dedicated Nutstore third-party application password. Do not use the normal account password. |
| `NUTSTORE_WEBDAV_URL` | `https://dav.jianguoyun.com/dav/` (optional; this is the default). |
| `NUTSTORE_API_TOKEN` | A long, random secret. Use this as the Bearer API key when adding the MCP server or GPT Action. |

Generate a separate Nutstore application password for this connector in Nutstore Account Information → Security Options → Third-party Application Management. Revoke it if you stop using the connector.

## Add to ChatGPT

### Custom GPT Action

1. Create or edit a custom GPT.
2. Add an Action and import the OpenAPI schema from `https://YOUR-VERCEL-DOMAIN/api/openapi.json`.
3. Choose API Key authentication using the Bearer scheme. Enter the same `NUTSTORE_API_TOKEN` set in Vercel.
4. Save and test with a read-only request first, such as listing `/`.

### MCP app

For a ChatGPT workspace that supports custom MCP apps, add `https://YOUR-VERCEL-DOMAIN/api/mcp` and configure Bearer/API-key authentication with the same token. Confirm developer-mode and plan availability in ChatGPT before deployment.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `.env.local` values before testing authenticated requests. Never commit `.env.local`.
