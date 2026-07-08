import type { ReactNode } from "react";
import { Anton, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Anton({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-display",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata = {
  title: "Liam · LinkedIn Ads Manager",
  description:
    "The LinkedIn Ads Manager you talk to. Describe the campaign and Liam drafts the audience, ad groups, and ads, from Claude over MCP or a CLI. Nothing spends until you activate it.",
};

export const viewport = {
  themeColor: "#0b0b0c",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
