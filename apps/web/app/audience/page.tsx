"use client";

import { useEffect, useRef, useState } from "react";

interface UploadResult {
  ok?: boolean;
  error?: string;
  segmentId?: string;
  uploaded?: number;
  totalRows?: number;
  skipped?: number;
  status?: string;
  accountId?: string;
  warnings?: string[];
}

export default function AudienceUpload() {
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [emailColumn, setEmailColumn] = useState("email");
  const [accountId, setAccountId] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Remember the token locally so it isn't retyped each visit.
  useEffect(() => {
    const t = localStorage.getItem("liam_token");
    if (t) setToken(t);
  }, []);
  useEffect(() => {
    if (token) localStorage.setItem("liam_token", token);
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setResult({ error: "Choose a CSV file first." });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set("token", token);
      fd.set("name", name);
      fd.set("emailColumn", emailColumn || "email");
      if (accountId) fd.set("accountId", accountId);
      fd.set("file", file);
      const res = await fetch("/api/audience", { method: "POST", body: fd });
      setResult(await res.json());
    } catch {
      setResult({ error: "Network error. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap page-narrow">
      <header className="topbar">
        <a className="back" href="/">
          ← LIAM
        </a>
        <span className="muted-label">UPLOAD AUDIENCE</span>
      </header>

      <main className="hero-narrow">
        <h1 className="section-title">Upload a matched audience</h1>
        <p className="tagline">
          Drop a CSV with an email column. Liam <em>SHA256-hashes</em> the emails on the server
          and creates a matched-audience segment. LinkedIn needs <span className="hot">300+ rows</span>{" "}
          and takes up to 48h to match.
        </p>

        <form className="form" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="token">Access token</label>
            <input
              id="token"
              className="input"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="MCP_AUTH_TOKEN"
              autoComplete="off"
            />
          </div>

          <div className="field">
            <label htmlFor="name">Audience name</label>
            <input
              id="name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Q3 target accounts"
              required
            />
          </div>

          <div className="row-2">
            <div className="field">
              <label htmlFor="col">Email column</label>
              <input id="col" className="input" value={emailColumn} onChange={(e) => setEmailColumn(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="acct">Ad account id (optional)</label>
              <input
                id="acct"
                className="input"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="defaults to configured account"
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="file">CSV file</label>
            <label className="filedrop">
              <input
                id="file"
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
              />
              {fileName ? <span className="filename">{fileName}</span> : <span>Choose a .csv file</span>}
            </label>
          </div>

          <button className="submit" type="submit" disabled={busy}>
            {busy ? "Uploading…" : "Upload audience"}
          </button>
        </form>

        {result && (
          <div className={`result ${result.error ? "err" : ""}`}>
            {result.error ? (
              <p>{result.error}</p>
            ) : (
              <>
                <p>
                  <span className="hot">Segment {result.segmentId}</span> created · status {result.status}
                </p>
                <p className="note">
                  {result.uploaded} hashed emails uploaded
                  {typeof result.skipped === "number" ? ` · ${result.skipped} skipped` : ""}
                  {result.accountId ? ` · account ${result.accountId}` : ""}
                </p>
                {result.warnings?.map((w, i) => (
                  <p className="warn" key={i}>
                    ! {w}
                  </p>
                ))}
              </>
            )}
          </div>
        )}
      </main>

      <footer className="footer">
        <span>Created as a private DMP segment. Targetable once matched.</span>
        <a href="https://github.com/stan-default/liam" target="_blank" rel="noreferrer">
          github.com/stan-default/liam ↗
        </a>
      </footer>
    </div>
  );
}
