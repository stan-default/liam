#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";

const server = new McpServer({ name: "liam", version: "0.1.0" }); // Liam, ad manager for LinkedIn
registerTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
