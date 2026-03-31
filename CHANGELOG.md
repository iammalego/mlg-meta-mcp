# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Ad set operations: get, create, update, pause, and activate ad sets.
- Ad operations: get and create ads.
- Productivity tools for campaign and ad set cloning.
- Bulk campaign activation and pause flows.
- Alert checking with configurable CPR, CTR, spend, and date thresholds.
- `compareTwoPeriods` insight workflow for comparing explicit periods across account, campaign, ad set, and ad levels.

### Changed

- Migrated MCP tool definitions to a **Zod-first registry**.
- Tool `inputSchema` is now derived from Zod definitions instead of being maintained manually.
- Tool arguments are now validated centrally before handler dispatch.
- `compareTwoPeriods` campaign comparisons now expose the reference actually used for the comparison.
- Similar-campaign fallback logic now requires matching campaign objective and dominant ad set optimization goal.
- Similar-campaign ranking now prioritizes budget similarity, bid strategy alignment, billing event alignment, and only uses name similarity as a tie-breaker.
- Public README rewritten to reflect the current project scope and open-source positioning.

### Fixed

- Reduced drift between public tool definitions and runtime validation by using the same Zod schemas for both.
- Prevented false positive similarity matches when optional bidding fields were missing on both campaigns.

## [0.1.0] - 2026-03-30

### Added

- Initial MCP server foundation for Meta Ads.
- Automatic ad account discovery via System User Token.
- Campaign read and status-management operations.
- Basic insights retrieval across account and object levels.
- TypeScript strict-mode project structure.
- Structured error handling and logging.
- Vitest, ESLint, and Prettier project setup.

### Notes

- This initial release established the core architecture and discovery flow.
- Later work expanded the tool surface with ad set operations, ad operations, productivity tools, and stronger insight comparison logic.
