import { CopyButton } from "./CopyButton";

const CONNECT_CMD =
  'npx mcp-remote https://liam-mcp.vercel.app/api/mcp --header "Authorization: Bearer <MCP_AUTH_TOKEN>"';

export default function Home() {
  return (
    <div className="wrap">
      <header className="topbar reveal d1">
        <span>
          <b>LIAM</b> · LINKEDIN AD MANAGER
        </span>
        <span className="status">
          <span className="dot" aria-hidden />
          ON DUTY
        </span>
      </header>

      <main className="hero">
        <p className="eyebrow reveal d1">MCP Server · Unofficial</p>

        <h1 className="wordmark reveal d2">
          LIAM<span className="caret" aria-hidden />
        </h1>

        <p className="tagline reveal d3">
          Your <em>LinkedIn ad manager</em>. Describe the campaign in plain language and Liam
          drafts the <em>audience</em>, <em>ad groups</em>, and <em>ads</em> for you. Built from a
          contact list and a brief, served over <em>MCP</em> or a CLI.{" "}
          <span className="hot">Nothing spends until you activate it.</span>
        </p>

        <section className="panel reveal d4" aria-label="Server readout">
          <div className="panel-head">
            <span>// readout</span>
            <span>rev 0.1.0</span>
          </div>
          <div className="spec">
            <div className="row">
              <span className="k">Endpoint</span>
              <span className="v">
                /api/mcp <span className="amber">· streamable http</span>
              </span>
            </div>
            <div className="row">
              <span className="k">Auth</span>
              <span className="v">authorization: bearer ‹token›</span>
            </div>
            <div className="row">
              <span className="k">Capabilities</span>
              <span className="v">
                <span className="amber">14</span> tools · targeting · audiences · conversions
              </span>
            </div>
            <div className="row">
              <span className="k">Policy</span>
              <span className="v">every campaign created as a draft</span>
            </div>
          </div>
        </section>

        <section className="connect reveal d5">
          <p className="label">Connect a client</p>
          <pre className="code">
            <CopyButton text={CONNECT_CMD} />
            <span className="prompt">$ </span>npx mcp-remote https://liam-mcp.vercel.app/api/mcp{"\n"}
            {"  "}<span className="flag">--header</span> &quot;Authorization: Bearer &lt;MCP_AUTH_TOKEN&gt;&quot;
          </pre>
        </section>
      </main>

      <footer className="footer reveal d5">
        <span>Unofficial. Not affiliated with or endorsed by LinkedIn.</span>
        <a href="https://github.com/stan-default/liam" target="_blank" rel="noreferrer">
          github.com/stan-default/liam ↗
        </a>
      </footer>
    </div>
  );
}
