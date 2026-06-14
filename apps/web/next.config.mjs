/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages ship prebuilt dist; no transpile needed.
  serverExternalPackages: ["@liads/core", "@liads/mcp"],
};

export default nextConfig;
