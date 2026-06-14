// Config & auth
export * from "./config.js";
export * from "./auth.js";
export * from "./http.js";
export * from "./client.js";
export * from "./urns.js";

// Schemas (zod) — reused as MCP tool input schemas
export * from "./schemas.js";

// Resource modules
export * from "./resources/accounts.js";
export * from "./resources/campaignGroups.js";
export * from "./resources/campaigns.js";
export * from "./resources/targeting.js";
export * from "./resources/creatives.js";
export * from "./resources/images.js";
export * from "./resources/dmpSegments.js";

// High-level workflows
export * from "./audience.js";
export * from "./creative.js";
export * from "./orchestrate.js";

// Salesforce reader (Phase 3 foundation)
export * from "./salesforce.js";
