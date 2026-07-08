import { CopyButton } from "./CopyButton";
import { SETUP_PROMPT } from "./setupPrompt";

const REPO = "https://github.com/stan-default/liam";

const CLI_CMD = `git clone ${REPO}.git liam
cd liam
pnpm install && pnpm -r build
node packages/cli/dist/index.js auth login
node packages/cli/dist/index.js accounts list`;

const MCP_CMD = "claude mcp add liam -- node /abs/path/liam/packages/mcp/dist/index.js";

const MCP_JSON = `{
  "mcpServers": {
    "liam": {
      "command": "node",
      "args": ["/abs/path/liam/packages/mcp/dist/index.js"]
    }
  }
}`;

const USE_CASES: Array<{ q: string; note: string }> = [
  {
    q: "How many VPs of demand gen at US SaaS companies can we reach?",
    note: "Resolves targeting facets and estimates reach before any money is involved.",
  },
  {
    q: "Upload this CSV as a matched audience.",
    note: "Cleans the columns, hashes emails, converts company domains to URLs.",
  },
  {
    q: "Build an audience from Salesforce: every contact on a target account.",
    note: "A SOQL query becomes a matched audience, no export step.",
  },
  {
    q: "Launch a draft campaign for that audience, $100 a day.",
    note: "Campaign group, ad group, and draft ads in one call, conversion attached.",
  },
  {
    q: "What ads is HubSpot running, and what offers are they pushing?",
    note: "Reads any company's ads from the public Ad Library: copy, formats, EU targeting.",
  },
  {
    q: "How did retargeting do last month vs the month before?",
    note: "Trend reports with deltas at any level: account, campaign, single ad.",
  },
  {
    q: "Which ads should I pause this week?",
    note: "Account rollup with top and bottom performers, plus flags worth acting on.",
  },
  {
    q: "Rewrite the copy on the losing ad.",
    note: "LinkedIn ignores edits to a live ad's post, so Liam recreates it as a fresh draft.",
  },
  {
    q: "Build last month's report: spend, CTR, cost per conversion.",
    note: "Pulls the month's numbers and names the underperformers in one pass.",
  },
];

export default function Home() {
  return (
    <div className="wrap">
      <header className="topbar reveal d1">
        <span>
          <b>LIAM</b> · LINKEDIN ADS MANAGER
        </span>
        <span className="status">
          <span className="dot" aria-hidden />
          ON DUTY
        </span>
      </header>

      <main>
        <section className="hero">
          <h1 className="wordmark reveal d1">
            LIAM<span className="caret" aria-hidden />
          </h1>

          <p className="tagline reveal d2">
            The <em>LinkedIn Ads Manager</em> you talk to. Describe the campaign in plain language
            and Liam drafts the <em>audience</em>, the <em>ad groups</em>, and the <em>ads</em>.
            Works from <em>Claude over MCP</em> or a <em>CLI</em>.
          </p>

          <p className="heroLinks reveal d3">
            <a href="#get-started">Get started ↓</a>
            <a href="#use-cases">What it can do ↓</a>
            <a href={REPO} target="_blank" rel="noreferrer">
              GitHub ↗
            </a>
          </p>
        </section>

        <section id="use-cases" className="section">
          <p className="kicker">What you can do</p>
          <h2>Ask it like you would ask a teammate.</h2>
          <div className="grid">
            {USE_CASES.map((u) => (
              <div className="card" key={u.q}>
                <p className="q">
                  <span className="prompt">&gt; </span>
                  {u.q}
                </p>
                <p className="note">{u.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="get-started" className="section">
          <p className="kicker">Get started</p>
          <h2>Bring your own LinkedIn app.</h2>
          <p className="sub">
            Liam runs against your own LinkedIn developer app, so your credentials and your ad
            account stay yours. Create an app at{" "}
            <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noreferrer">
              linkedin.com/developers/apps
            </a>
            , request the <em>Advertising API</em> product (add <em>Audiences</em> for CSV uploads
            and <em>Ad Library</em> for competitor metadata), and add{" "}
            <code>http://localhost:53682/callback</code> as a redirect URL. Login asks for the{" "}
            <code>rw_ads</code>, <code>r_ads_reporting</code>, <code>rw_conversions</code>, and{" "}
            <code>w_organization_social</code> scopes.
          </p>

          <div className="cols">
            <div className="col">
              <h3>1 · The CLI</h3>
              <p className="note">
                Clone, build, log in through your browser, and verify. Then every capability is a{" "}
                <code>liam</code> command.
              </p>
              <pre className="code">
                <CopyButton text={CLI_CMD} />
                {CLI_CMD}
              </pre>
            </div>
            <div className="col">
              <h3>2 · MCP</h3>
              <p className="note">
                Same setup, then register the server so Claude can use it. One line in Claude
                Code:
              </p>
              <pre className="code">
                <CopyButton text={MCP_CMD} />
                {MCP_CMD}
              </pre>
              <p className="note">Claude Desktop, Cursor, or any MCP client:</p>
              <pre className="code">
                <CopyButton text={MCP_JSON} />
                {MCP_JSON}
              </pre>
            </div>
          </div>

          <p className="note fine">
            Want it in the cloud? The repo ships a single-tenant hosted mode for Vercel. See the{" "}
            <a href={`${REPO}#get-started`} target="_blank" rel="noreferrer">
              README
            </a>{" "}
            for the full walkthrough, permissions table, and hosted setup.
          </p>
        </section>

        <section id="setup-prompt" className="section">
          <p className="kicker">One prompt setup</p>
          <h2>Or paste this into Claude.</h2>
          <p className="sub">
            Copy the whole block into Claude (or any assistant with terminal access) and it walks
            you through everything: prerequisites, the LinkedIn app, login, and connecting the
            MCP server.
          </p>
          <pre className="code promptbox" tabIndex={0}>
            <CopyButton text={SETUP_PROMPT} />
            {SETUP_PROMPT}
          </pre>
        </section>
      </main>

      <footer className="footer">
        <span>Unofficial. Not affiliated with or endorsed by LinkedIn.</span>
        <a href={REPO} target="_blank" rel="noreferrer">
          github.com/stan-default/liam ↗
        </a>
      </footer>
    </div>
  );
}
