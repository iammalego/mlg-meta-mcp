# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Ad set operations: get, create, update, pause, and activate ad sets.
- Ad operations: get ads.
- Productivity tools for campaign and ad set cloning.
- Bulk campaign activation and pause flows.
- Alert checking with configurable CPR, CTR, spend, and date thresholds.
- `compareTwoPeriods` insight workflow for comparing explicit periods across account, campaign, ad set, and ad levels.
- `cpm` and `cpp` fields now included in insights responses (previously fetched from the API but discarded).
- `getInsights` at non-account levels now returns a per-item breakdown instead of a single aggregate, so each campaign, ad set, or ad is individually visible.

### Changed

- Migrated MCP tool definitions to a **Zod-first registry**.
- Tool `inputSchema` is now derived from Zod definitions instead of being maintained manually.
- Tool arguments are now validated centrally before handler dispatch.
- `compareTwoPeriods` campaign comparisons now expose the reference actually used for the comparison.
- Similar-campaign fallback logic now requires matching campaign objective and dominant ad set optimization goal.
- Similar-campaign ranking now prioritizes budget similarity, bid strategy alignment, billing event alignment, and only uses name similarity as a tie-breaker.
- Public README rewritten to reflect the current project scope and open-source positioning.
- `cloneCampaign` and `cloneAdSet` no longer accept a `copyAds` parameter; ad creation is a planned feature and not yet supported.
- Bulk operation errors now include the HTTP status code and error category for easier debugging.

### Fixed

- `calculateResults` now counts only the primary conversion action (identified via `cost_per_action_type`) instead of summing all action types. This prevents video views, page engagement, and other non-goal events from inflating result counts.
- `getCampaignInsights` (used by `checkAlerts`) applies the same primary-action filter, so alert thresholds compare against accurate result totals.
- `getCampaignInsights` now logs errors before returning `null` instead of swallowing failures silently.
- Budget similarity scoring for ABO campaigns (budget at ad set level) now falls back to summing ad set budgets when the campaign has no campaign-level budget, preventing valid candidates from being scored as zero-budget.
- `classifyMetaError` accepts an optional `originalError` argument so the underlying cause is preserved on the resulting `MetaMcpError`.
- `impressions` and `clicks` parsing now uses `Math.round(Number(...))` instead of `parseInt`, guarding against fractional string edge cases.
- Invalid identifiers passed to `getAdSets` are no longer silently forwarded to the Meta API; an error is thrown if the identifier is not a recognized account ID, campaign ID, or account name.
- Reduced drift between public tool definitions and runtime validation by using the same Zod schemas for both.
- Prevented false positive similarity matches when optional bidding fields were missing on both campaigns.

### Removed

- `createAd` tool — ad creation requires a Meta-linked page ID and fully constructed creative payload that the current implementation cannot reliably provide. The feature is tracked in the roadmap.
- Internal `deleteCampaign` method on `GraphClient` — the equivalent operation is already available via `pauseCampaign`.

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
