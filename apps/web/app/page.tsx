export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "10vh auto", padding: "0 24px", lineHeight: 1.6 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>liads</h1>
      <p style={{ color: "#555" }}>
        Hosted MCP server for LinkedIn ad automation. The MCP endpoint is{" "}
        <code>/api/mcp</code>. Connect a client with your access token in the{" "}
        <code>Authorization: Bearer</code> header.
      </p>
      <p style={{ color: "#888", fontSize: 14 }}>
        Source and self-host instructions live in the GitHub repository. Everything is created as a draft.
      </p>
    </main>
  );
}
