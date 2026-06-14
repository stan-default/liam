# liads

Create LinkedIn ad campaigns by talking to Claude (MCP) or from a CLI. Built for
go-to-market teams who want to spin up many campaigns from a contact list and a brief,
then add creative images themselves. Everything is created as a **draft**, so nothing
spends until you explicitly activate it in Campaign Manager.

> Optimization features (performance insights, Salesforce cross-reference) are on the
> roadmap. This release covers creation.

## Hierarchy mapping (LinkedIn differs from Google/Meta)

| Common term | LinkedIn entity    | Holds                                    |
| ----------- | ------------------ | ---------------------------------------- |
| Campaign    | **Campaign Group** | status, total/shared budget              |
| Ad group    | **Campaign**       | targeting, budget, bid, schedule, format |
| Ad          | **Creative**       | the rendered ad (`status: DRAFT`)        |
| Audience    | **DMP Segment**    | attached to a Campaign's targeting       |

## Packages

- `@liads/core` — LinkedIn REST client, OAuth, resource modules, CSV + SHA256 hashing, Salesforce reader.
- `@liads/mcp` — MCP server (stdio for local; reused by the hosted app). **Primary interface.**
- `@liads/cli` — `liads` CLI over the same core, for scripted batch runs.
- `@liads/web` — Next.js app that hosts the MCP over HTTP on Vercel.

## Prerequisites (everyone needs their own LinkedIn app)

1. Create a developer app at https://www.linkedin.com/developers/apps and request the
   **Advertising API** product. (The **Audiences** product, needed for CSV audience upload,
   is requested separately.)
2. Add an OAuth **redirect URL** of `http://localhost:53682/callback` for local login.

## Option A — Run locally (self-host, free)

```bash
pnpm install
pnpm -r build

# App credentials (alternatively set LIADS_CLIENT_ID / LIADS_CLIENT_SECRET env vars)
mkdir -p ~/.liads
echo '{ "clientId": "...", "clientSecret": "...", "linkedinVersion": "202605" }' > ~/.liads/config.json

node packages/cli/dist/index.js auth login     # opens browser, stores tokens in ~/.liads
node packages/cli/dist/index.js accounts list   # verify
node packages/cli/dist/index.js launch --brief examples/brief.json
```

Register the local MCP server with Claude (Desktop / Code):

```json
{
  "mcpServers": {
    "liads": { "command": "node", "args": ["/abs/path/linkedin-ads/packages/mcp/dist/index.js"] }
  }
}
```

## Option B — Host the MCP on Vercel (single-tenant, for you)

1. Get your env values locally: `node packages/cli/dist/index.js auth export`.
2. Deploy `apps/web` to Vercel (set the project **Root Directory** to `apps/web`).
3. In Vercel project settings, add the env vars from `.env.example`
   (`LIADS_CLIENT_ID`, `LIADS_CLIENT_SECRET`, `LIADS_REFRESH_TOKEN`, `LIADS_LINKEDIN_VERSION`,
   and a strong `MCP_AUTH_TOKEN`).
4. Your MCP endpoint is `https://<your-app>.vercel.app/api/mcp`.

Connect Claude to the remote server (header carries the secret):

```bash
npx mcp-remote https://<your-app>.vercel.app/api/mcp --header "Authorization: Bearer <MCP_AUTH_TOKEN>"
```

## Tools (MCP)

`list_ad_accounts`, `estimate_audience`, `upload_audience_csv`, `get_audience_status`,
`create_campaign_group`, `create_campaign`, `create_text_ad`, `create_image_ad`,
`launch_from_brief` (the end-to-end orchestrator).

## Safety

- Every campaign/creative is created **DRAFT/PAUSED**. Activation is a separate, explicit step.
- Matched-audience matching takes up to 48h, and a campaign needs ~300 matched members to serve.
- LinkedIn does not expose person-level ad-view data; cross-referencing is account/segment-level.
- Secrets never enter the repo. Local: `~/.liads`. Hosted: Vercel env vars.

## License

MIT
