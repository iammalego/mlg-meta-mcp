# API Reference

This project currently exposes **30 MCP tools**. The tool registry in `src/tools/index.ts` is the authoritative source for names, descriptions, and argument validation.

## Conventions

- IDs are strings.
- Where supported, `accountId` may be either an `act_...` account ID or an account name.
- Budget values are expressed in cents.
- Validation is enforced from Zod schemas before a handler runs.
- Core tool contracts preserve maximal useful signal; consumers own filtering and interpretation.

## Account tools

| Tool                 | Purpose                                                          | Key arguments |
| -------------------- | ---------------------------------------------------------------- | ------------- |
| `discoverAdAccounts` | List ad accounts accessible to the configured System User token. | None |
| `getAccountInfo` | Get full account details: name, currency, timezone, status, business. | `accountId` |

## Campaign tools

| Tool                  | Purpose                                                           | Key arguments                                                                  |
| --------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `getCampaigns`        | List campaigns for an ad account, with optional status filtering. | `accountId`, `status` (`ACTIVE`/`PAUSED`/`ALL`)                                |
| `getCampaignDetails`  | Get full campaign details including bid strategy, buying type, special ad categories, stop time, and issues. | `campaignId` |
| `updateCampaign`      | Update campaign fields selectively.                               | `campaignId`, one or more of `name`, `status`, `dailyBudget`, `lifetimeBudget` |
| `pauseCampaign`       | Pause a campaign.                                                 | `campaignId`                                                                   |
| `activateCampaign`    | Reactivate a paused campaign.                                     | `campaignId`                                                                   |
| `cloneCampaign`       | Clone a campaign structure, optionally copying ad sets.           | `sourceCampaignId`, `newName`, `copyAdSets?`, `budgetAdjustment?`              |
| `bulkPauseCampaigns`  | Pause multiple campaigns in one request, with optional dry run.   | `campaignIds[]`, `dryRun?`                                                     |
| `bulkActivateCampaigns` | Activate multiple campaigns in one request, with optional dry run. | `campaignIds[]`, `dryRun?`                                                  |

## Ad set tools

| Tool               | Purpose                                 | Key arguments                                                                                                    |
| ------------------ | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `getAdSets`        | List ad sets for a campaign or account. | `campaignId?`, `accountId?`, `status` (`ACTIVE`/`PAUSED`/`ALL`)                                                 |
| `getAdSetDetails`  | Get full ad set details including targeting, optimization goal, bid amount, and effective status. | `adSetId` |
| `updateAdSet`      | Update ad set fields selectively.       | `adSetId`, one or more of `name`, `status`, `dailyBudget`, `lifetimeBudget`, `targeting`                         |
| `pauseAdSet`       | Pause an ad set.                        | `adSetId`                                                                                                        |
| `activateAdSet`    | Reactivate a paused ad set.             | `adSetId`                                                                                                        |
| `cloneAdSet`       | Clone an ad set into a target campaign. | `sourceAdSetId`, `targetCampaignId`, `newName?`                                                                  |

At least one parent identifier is required for `getAdSets`.

## Ad tools

| Tool           | Purpose                             | Key arguments                                                 |
| -------------- | ----------------------------------- | ------------------------------------------------------------- |
| `getAds`       | List ads for an ad set or campaign. | `adSetId?`, `campaignId?`, `status` (`ACTIVE`/`PAUSED`/`ALL`) |
| `getAdDetails` | Get full ad details including effective status, creative ID, and issues. | `adId` |
| `updateAd`     | Update ad status and/or bid amount. | `adId`, `status?`, `bidAmount?` |

## Creative tools

| Tool             | Purpose                             | Key arguments |
| ---------------- | ----------------------------------- | ------------- |
| `getAdCreatives` | Get creatives attached to an ad (object_story_spec, image hash, call to action). | `adId` |

## Targeting tools

| Tool                      | Purpose                             | Key arguments                                                 |
| ------------------------- | ----------------------------------- | ------------------------------------------------------------- |
| `searchInterests`         | Search interests by keyword. Returns id, name, audience_size. | `query`, `limit?` |
| `getInterestSuggestions`  | Get interest suggestions from a seed interest list. | `interestList` (string[]), `limit?` |
| `validateInterests`       | Validate interests by name or Meta ID. At least one list required. | `interestList?` (string[]), `interestFbidList?` (string[]) |
| `searchBehaviors`         | Browse all behavior targeting categories. | `limit?` |
| `searchDemographics`      | Browse demographic targeting categories by class. | `demographicClass`, `limit?` |
| `searchGeoLocations`      | Search geo locations by keyword. | `query`, `locationTypes?` (string[]), `limit?` |

All targeting tools return `[]` when the search produces no results (never an error).

## Budget tools

| Tool                   | Purpose                             | Key arguments                                                 |
| ---------------------- | ----------------------------------- | ------------------------------------------------------------- |
| `createBudgetSchedule` | Create a time-bounded budget multiplier or absolute increase for a campaign. | `campaignId`, `budgetValue`, `budgetValueType` (`ABSOLUTE`/`MULTIPLIER`), `timeStart` (Unix timestamp), `timeEnd` (Unix timestamp) |

## Insights tools

| Tool                | Purpose                                                               | Key arguments                                                                                                                              |
| ------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `getInsights`       | Fetch performance metrics for an account, campaign, ad set, or ad.    | `objectId`, `level` (`account`/`campaign`/`adset`/`ad`), `datePreset?`, `timeRange?`                                                       |
| `compareTwoPeriods` | Compare two explicit periods and explain the reference baseline used. | `objectId`, `level` (`account`/`campaign`/`adset`/`ad`), `currentPeriod`, `previousPeriod`, `resultMode?`, `resultActionType?`, `metrics?` |

### `getInsights`

- For `level: account`, returns a single aggregated summary.
- For `level: campaign`, `adset`, or `ad`, returns both a readable text summary and `structuredContent` with per-item metrics so each object remains individually visible.
- `timeRange` uses `{ since, until }` in `YYYY-MM-DD` format and takes precedence over `datePreset`.
- Supported presets: `today`, `yesterday`, `last_7d`, `last_30d`, `this_month`, `last_month`.

#### `getInsights` structured content contract for `campaign` / `adset` / `ad`

```json
{
  "objectId": "string",
  "level": "campaign | adset | ad",
  "requestedPeriod": "string | null",
  "requestedTimeRange": { "since": "YYYY-MM-DD", "until": "YYYY-MM-DD" } | null,
  "summary": {
    "itemCount": 0,
    "dateRange": "YYYY-MM-DD → YYYY-MM-DD",
    "totals": {
      "spend": 0,
      "results": 0,
      "cpr": 0,
      "impressions": 0,
      "clicks": 0,
      "ctr": 0
    }
  },
  "items": [
    {
      "level": "campaign | adset | ad",
      "id": "normalized item id",
      "name": "normalized item name",
      "campaignId": "string?",
      "campaignName": "string?",
      "adsetId": "string?",
      "adsetName": "string?",
      "adId": "string?",
      "adName": "string?",
      "spend": 0,
      "results": 0,
      "cpr": 0,
      "impressions": 0,
      "clicks": 0,
      "ctr": 0,
      "cpm": 0,
      "cpp": 0,
      "actions": [{ "actionType": "string", "value": "string" }],
      "costPerActionType": [{ "actionType": "string", "value": "string" }],
      "dateStart": "YYYY-MM-DD",
      "dateStop": "YYYY-MM-DD",
      "dateRange": "YYYY-MM-DD → YYYY-MM-DD"
    }
  ]
}
```

`id` and `name` are normalized for the requested level, while the more specific campaign/ad set/ad identifiers are also preserved when available.

### `compareTwoPeriods`

For `account`, `adset`, and `ad`, the comparison is a direct same-object comparison between the requested periods.

For `campaign`, the service uses an explicit fallback chain:

1. **Same campaign in the previous period**
2. **Most similar campaign in the same account**
3. **Account campaign average for the previous period**
4. **Zero baseline when no reference exists**

The tool response always includes a `Reference Used` explanation.

#### Input contract

```json
{
  "objectId": "string",
  "level": "account | campaign | adset | ad",
  "currentPeriod": {
    "datePreset": "today | yesterday | last_7d | last_30d | this_month | last_month"
  },
  "previousPeriod": {
    "timeRange": {
      "since": "YYYY-MM-DD",
      "until": "YYYY-MM-DD"
    }
  },
  "resultMode": "primary_from_insights | specific_action | all_actions",
  "resultActionType": "lead | purchase | ...",
  "metrics": ["spend", "results", "cpr", "impressions", "clicks", "ctr"]
}
```

- Each period MUST provide exactly one of `datePreset` or `timeRange`.
- `resultMode` defaults to `primary_from_insights`.
- `resultActionType` is only valid for `specific_action`.
- `metrics` is optional. Omit it to keep the backward-compatible default set: `spend`, `results`, `cpr`.
- For convenience, a single metric string is accepted and normalized into an array.
- Legacy preset strings for `currentPeriod` / `previousPeriod` are still accepted and normalized for compatibility.

#### Output additions

`compareTwoPeriods` now returns `structuredContent` with:

- requested current/previous periods
- resolved `resultDefinition` (`requestedMode`, `resolvedMode`, `resolvedActionType`, `resolutionSource`, `message`)
- neutral comparison context (`fallbackApplied`, `fallbackSource`, `significanceThresholdPercentage`)
- reference metadata (`same_campaign`, `similar_campaign`, `account_average`, etc.)
- requested metrics plus returned per-metric current/previous values and calculated changes

That keeps the contract honest when `results` are based on one resolved action type instead of an implicit fallback.

#### `structuredContent.metrics` contract

```json
{
  "requested": ["spend", "ctr"],
  "returned": {
    "spend": {
      "label": "Spend",
      "unit": "currency_cents",
      "current": 12000,
      "previous": 9000,
      "change": {
        "absolute": 3000,
        "percentage": 33.33,
        "direction": "up",
        "significant": true
      }
    },
    "ctr": {
      "label": "CTR",
      "unit": "percentage",
      "current": 3,
      "previous": 2.57,
      "change": {
        "absolute": 0.43,
        "percentage": 16.73,
        "direction": "up",
        "significant": true
      }
    }
  }
}
```

`resultDefinition` remains present in `structuredContent` even when `results`/`cpr` are not requested, so consumers still have the exact context for how result-based metrics would be interpreted.

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


## Notes for contributors

If you add or change a tool:

1. update `src/tools/index.ts`
2. keep `src/tools/handlers.ts` aligned
3. add or adjust tests
4. update `README.md` and this document
