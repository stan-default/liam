"use client";

import { useState } from "react";

const btnStyle: React.CSSProperties = {
  position: "absolute",
  top: 10,
  right: 10,
  background: "transparent",
  border: "1px solid var(--amber-dim)",
  color: "var(--amber)",
  font: "inherit",
  fontSize: 10,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  padding: "5px 9px",
  cursor: "pointer",
  transition: "background 0.15s",
};

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      style={btnStyle}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          /* clipboard unavailable */
        }
      }}
      aria-label="Copy command"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
