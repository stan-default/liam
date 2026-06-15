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
        <h1 className="wordmark reveal d1">
          LIAM<span className="caret" aria-hidden />
        </h1>

        <p className="tagline reveal d2">
          Your <em>LinkedIn ad manager</em>. Describe the campaign in plain language and Liam
          drafts the <em>audience</em>, <em>ad groups</em>, and <em>ads</em> for you. Built from a
          contact list and a brief, served over <em>MCP</em> or a CLI.{" "}
          <span className="hot">Nothing spends until you activate it.</span>
        </p>

        <section className="connect reveal d3">
          <p className="label">Connect a client</p>
          <pre className="code">
            <CopyButton text={CONNECT_CMD} />
            <span className="prompt">$ </span>npx mcp-remote https://liam-mcp.vercel.app/api/mcp{"\n"}
            {"  "}<span className="flag">--header</span> &quot;Authorization: Bearer &lt;MCP_AUTH_TOKEN&gt;&quot;
          </pre>
        </section>
      </main>

      <footer className="footer reveal d4">
        <span>Unofficial. Not affiliated with or endorsed by LinkedIn.</span>
        <a href="https://github.com/stan-default/liam" target="_blank" rel="noreferrer">
          github.com/stan-default/liam ↗
        </a>
      </footer>
    </div>
  );
}
