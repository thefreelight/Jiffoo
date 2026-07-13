# License Audit Report

> Generated: 2026-07-05  
> Task: 1.1.1–1.1.3 (License inventory, contributor check, obfuscation usage)

## 1. Package License Inventory

| Package | name | Current License | Target License | LICENSE file | File header |
|---------|------|----------------|----------------|-------------|-------------|
| Root monorepo | `jiffoo-mall-core` | GPL-2.0-or-later | GPL-2.0-or-later (keep) | ✅ exists | N/A |
| `packages/shared` | `shared` | MIT | MIT (keep) | ❌ missing | none |
| `packages/ui` | `@jiffoo/ui` | MIT | MIT (keep) | ❌ missing | none |
| `packages/plugin-sdk` | `@jiffoo/plugin-sdk` | **GPL-3.0** | **MIT** ⚠️ | ❌ missing | none |
| `packages/theme-api-sdk` | `@jiffoo/theme-api-sdk` | MIT | MIT (keep) | ❌ missing | none |
| `packages/core-api-sdk` | `@jiffoo/core-api-sdk` | MIT | MIT (keep) | ❌ missing | none |
| `packages/create-jiffoo-app` | `create-jiffoo-app` | MIT | MIT (keep) | ❌ missing | none |

### Action Items
- **`@jiffoo/plugin-sdk`**: Change `license` field from `GPL-3.0` to `MIT` in package.json
- All 5 MIT packages: Add `LICENSE` file (MIT text)
- No file headers present — no headers to replace

## 2. Contributor Check

All three SDK packages (`plugin-sdk`, `theme-api-sdk`, `core-api-sdk`) have **exactly one contributor**:

| Package | Contributors |
|---------|-------------|
| `packages/plugin-sdk` | `thefreelight <624263170@qq.com>` |
| `packages/theme-api-sdk` | `thefreelight <624263170@qq.com>` |
| `packages/core-api-sdk` | `thefreelight <624263170@qq.com>` |

### Conclusion
No external contributors. The copyright holder (`thefreelight`) can unilaterally re-license all packages. No contributor agreement needed.

## 3. JavaScript Obfuscator Usage

### Dependency Location
- `javascript-obfuscator@^4.1.1` is listed in root `package.json` `devDependencies`
- **No source code imports** of `javascript-obfuscator` found in `apps/`, `packages/`, or `scripts/`

### Actual Usage
The `javascript-obfuscator` dependency exists in `package.json` but **no active import or usage** was found in the open-source codebase. It may have been:
1. Used historically in the `build:official-artifacts` pipeline (now removed/refactored)
2. A leftover from a previous commercial artifact build step
3. Used via CLI invocation not captured in source grep

### Recommendation
- Mark as deprecated in `build:official-artifacts` script (task 1.6.1)
- Add deprecation warning pointing to Entitlement Service migration
- Consider removing the devDependency if no usage is confirmed

## 4. Summary

| Check | Status |
|-------|--------|
| License inventory complete | ✅ |
| Plugin-sdk needs MIT re-license | ⚠️ Action needed |
| All SDKs single-contributor (safe to re-license) | ✅ |
| Obfuscator: no active source usage | ✅ |
| LICENSE files missing for all MIT packages | ⚠️ Add files |
