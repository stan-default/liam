import type { ReactNode } from "react";

export const metadata = {
  title: "liads — LinkedIn ads automation",
  description: "MCP server and CLI for creating LinkedIn ad campaigns.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", margin: 0 }}>{children}</body>
    </html>
  );
}
