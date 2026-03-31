# API Reference

This project currently exposes **19 MCP tools**. The tool registry in `src/tools/index.ts` is the authoritative source for names, descriptions, and argument validation.

## Conventions

- IDs are strings.
- Where supported, `accountId` may be either an `act_...` account ID or an account name.
- Budget values are expressed in cents.
- Validation is enforced from Zod schemas before a handler runs.

## Account discovery

| Tool                 | Purpose                                                          | Key arguments |
| -------------------- | ---------------------------------------------------------------- | ------------- |
| `discoverAdAccounts` | List ad accounts accessible to the configured System User token. | None          |

## Campaign tools

| Tool               | Purpose                                                           | Key arguments                                                                  |
| ------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `getCampaigns`     | List campaigns for an ad account, with optional status filtering. | `accountId`, `status` (`ACTIVE`/`PAUSED`/`ALL`)                                |
| `createCampaign`   | Create a campaign in an account.                                  | `accountId`, `name`, `objective`, `status`, `dailyBudget?`, `lifetimeBudget?`  |
| `updateCampaign`   | Update campaign fields selectively.                               | `campaignId`, one or more of `name`, `status`, `dailyBudget`, `lifetimeBudget` |
| `pauseCampaign`    | Pause a campaign.                                                 | `campaignId`                                                                   |
| `activateCampaign` | Reactivate a paused campaign.                                     | `campaignId`                                                                   |

## Ad set tools

| Tool            | Purpose                                 | Key arguments                                                                                                                          |
| --------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `getAdSets`     | List ad sets for a campaign or account. | `campaignId?`, `accountId?`, `status` (`ACTIVE`/`PAUSED`/`ALL`)                                                                        |
| `createAdSet`   | Create an ad set under a campaign.      | `campaignId`, `name`, `dailyBudget?`, `lifetimeBudget?`, `targeting?`, `bidStrategy?`, `billingEvent?`, `optimizationGoal?`, `status?` |
| `updateAdSet`   | Update ad set fields selectively.       | `adSetId`, one or more of `name`, `status`, `dailyBudget`, `lifetimeBudget`, `targeting`                                               |
| `pauseAdSet`    | Pause an ad set.                        | `adSetId`                                                                                                                              |
| `activateAdSet` | Reactivate a paused ad set.             | `adSetId`                                                                                                                              |

At least one parent identifier is required for `getAdSets`.

## Ad tools

| Tool     | Purpose                             | Key arguments                                                 |
| -------- | ----------------------------------- | ------------------------------------------------------------- |
| `getAds` | List ads for an ad set or campaign. | `adSetId?`, `campaignId?`, `status` (`ACTIVE`/`PAUSED`/`ALL`) |

> **Ad creation** is planned but not yet available. Creating ads requires a Meta-linked page ID and a fully constructed creative payload. See the project roadmap.

## Insights tools

| Tool                | Purpose                                                                       | Key arguments                                                                              |
| ------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `getInsights`       | Fetch performance metrics for an account, campaign, ad set, or ad.            | `objectId`, `level` (`account`/`campaign`/`adset`/`ad`), `datePreset?`, `timeRange?`       |
| `compareTwoPeriods` | Compare two explicit periods and explain the reference baseline used.         | `objectId`, `level` (`account`/`campaign`/`adset`/`ad`), `currentPeriod`, `previousPeriod` |

### `getInsights`

- For `level: account`, returns a single aggregated summary.
- For `level: campaign`, `adset`, or `ad`, returns a per-item breakdown so each object is individually visible.
- `timeRange` uses `{ since, until }` in `YYYY-MM-DD` format and takes precedence over `datePreset`.
- Supported presets: `today`, `yesterday`, `last_7d`, `last_30d`, `this_month`, `last_month`.

### `compareTwoPeriods`

For `account`, `adset`, and `ad`, the comparison is a direct same-object comparison between the requested periods.

For `campaign`, the service uses an explicit fallback chain:

1. **Same campaign in the previous period**
2. **Most similar campaign in the same account**
3. **Account campaign average for the previous period**
4. **Zero baseline when no reference exists**

The tool response always includes a `Reference Used` explanation.

#### Similar campaign fallback

The similar-campaign fallback is only allowed when a candidate matches both:

- the same campaign `objective`
- the same dominant ad set `optimizationGoal`

Candidates that pass those hard checks are ranked by:

- budget similarity (supports both CBO and ABO campaigns)
- bid strategy match
- billing event match
- name similarity as a tie-breaker

If no candidate qualifies but the account has campaign insights for the previous period, the service uses the account campaign average. If even that does not exist, the comparison falls back to zeroed historical metrics and reports that no usable reference was available.

## Productivity tools

| Tool                    | Purpose                                                            | Key arguments                                                      |
| ----------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `cloneCampaign`         | Clone a campaign structure, optionally copying ad sets.            | `sourceCampaignId`, `newName`, `copyAdSets?`, `budgetAdjustment?`  |
| `cloneAdSet`            | Clone an ad set into a target campaign.                            | `sourceAdSetId`, `targetCampaignId`, `newName?`                    |
| `bulkPauseCampaigns`    | Pause multiple campaigns in one request, with optional dry run.    | `campaignIds[]`, `dryRun?`                                         |
| `bulkActivateCampaigns` | Activate multiple campaigns in one request, with optional dry run. | `campaignIds[]`, `dryRun?`                                         |
| `checkAlerts`           | Flag campaign-level performance issues using thresholds.           | `accountId`, `cprThreshold?`, `minCtr?`, `minDailySpend?`, `datePreset?` |

## Notes for contributors

If you add or change a tool:

1. update `src/tools/index.ts`
2. keep `src/tools/handlers.ts` aligned
3. add or adjust tests
4. update `README.md` and this document
