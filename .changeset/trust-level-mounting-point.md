---
"@jiffoo/shared": minor
"@jiffoo/plugin-sdk": minor
---

Feature: Added `PluginTrustLevel` type (`builtin | official | third-party`) to the shared plugin contract. Plugin manifests now support an optional `trustLevel` field that is required for `internal-fastify` plugins. This is the mounting point for the two-tier trust model (R2) — enforcement logic will be implemented in the extension installer (task 2.3).
