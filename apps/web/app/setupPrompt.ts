/**
 * The paste-in setup prompts shown on the landing page. Both share the same
 * core steps; only the last mile differs (CLI usage vs registering the MCP
 * server). README.md carries a combined version of the same walkthrough.
 */
const INTRO = `You are helping me set up Liam, an open-source LinkedIn Ads Manager from
https://github.com/stan-default/liam. It runs locally as a CLI and an MCP server.
Everything it creates on LinkedIn is a draft, so nothing spends money until I
activate it myself in Campaign Manager.

Walk me through the setup one step at a time. Run commands for me where you can,
show me exactly what to click where you cannot, and wait for my confirmation
before moving to the next step.

1. Check that git, Node.js 20 or newer, and pnpm are installed. Help me install
   whatever is missing.
2. Clone https://github.com/stan-default/liam and run "pnpm install" then
   "pnpm -r build" in the repo root.
3. Help me create a LinkedIn developer app at
   https://www.linkedin.com/developers/apps (it must be associated with my
   company's LinkedIn Page):
   a. On the Products tab, request access to the "Advertising API" product.
      This is the only required product; approval can take a while.
   b. Optional: also request "Audiences" if I want to upload CSV contact or
      company lists as matched audiences.
   c. Optional: also request "LinkedIn Ad Library" if I want competitor ad
      metadata through the official API.
   d. On the Auth tab, add http://localhost:53682/callback as an authorized
      redirect URL, and show me where the Client ID and Client Secret live.
4. Create ~/.liads/config.json containing my clientId, clientSecret, and
   "linkedinVersion": "202605".
5. Run "node packages/cli/dist/index.js auth login". My browser opens LinkedIn's
   consent screen; after I approve, tokens are stored in ~/.liads/credentials.json.
6. Verify with "node packages/cli/dist/index.js accounts list". If no accounts
   show up, remind me to map my ad account in the Developer Portal under
   Products > Advertising API > View Ad Accounts. Then set my account id as
   "defaultAccountId" in ~/.liads/config.json.`;

const OUTRO = `

If any step fails, show me the exact error and fix it with me before moving on.`;

export const CLI_SETUP_PROMPT = `${INTRO}
7. Link the CLI globally with "cd packages/cli && pnpm link --global" so I can
   run "liam" from anywhere, and confirm "liam accounts list" works.
8. Show me a first session: "liam report summary -p last_30_days" and
   "liam targeting search titles" with a title I care about.${OUTRO}`;

export const MCP_SETUP_PROMPT = `${INTRO}
7. Register the MCP server:
   - In Claude Code: claude mcp add liam -- node <abs repo path>/packages/mcp/dist/index.js
   - For Claude Desktop or another MCP client, print the JSON I need to add
     under mcpServers in its config ({"command": "node", "args":
     ["<abs repo path>/packages/mcp/dist/index.js"]}) and tell me where that
     config file lives on my machine.
8. Confirm the tools load, then show me one read-only call working, for example
   list_ad_accounts or a last_30_days performance summary.${OUTRO}`;
