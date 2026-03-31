/**
 * Insights Service
 *
 * Lógica de negocio para métricas y reportes.
 * Procesa datos de Insights API y los formatea para presentación.
 */

import { GraphClient } from '../api/graph-client.js';
import { InsightsClient } from '../api/insights-client.js';
import type { AccountService } from './account-service.js';
import type { MetaAdSet, MetaCampaign, MetaInsights } from '../types/index.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

interface CampaignSimilarityProfile {
  objective: string;
  dominantOptimizationGoal?: string;
  budget?: number;
  bidStrategy?: string;
  billingEvent?: string;
}

export interface FormattedMetrics {
  spend: number; // Already in cents from API
  results: number; // Sum of all actions
  cpr: number; // Cost per result
  impressions: number;
  clicks: number;
  ctr: number;
  dateRange: string;
}

export interface AccountSummary {
  accountName: string;
  accountId: string;
  dateRange: string;
  totals: FormattedMetrics;
  topCampaigns: Array<{
    name: string;
    spend: number;
    results: number;
  }>;
  campaignsPaused: number;
  campaignsActive: number;
}

export interface MetricChange {
  absolute: number;
  percentage: number;
  direction: 'up' | 'down' | 'same';
  significant: boolean;
}

export interface PeriodComparison {
  current: FormattedMetrics;
  previous: FormattedMetrics;
  reference: {
    basis:
      | 'same_object'
      | 'same_campaign'
      | 'similar_campaign'
      | 'account_average'
      | 'no_reference';
    message: string;
    referenceCampaign?: {
      id: string;
      name: string;
    };
  };
  changes: {
    spend: MetricChange;
    results: MetricChange;
    cpr: MetricChange;
  };
}

const SIGNIFICANT_CHANGE_THRESHOLD = 10;

export class InsightsService {
  private client: InsightsClient;
  private graphClient: GraphClient;
  private accountService: AccountService;

  constructor(accessToken: string, accountService: AccountService) {
    this.client = new InsightsClient(accessToken);
    this.graphClient = new GraphClient(accessToken);
    this.accountService = accountService;
  }

  /**
   * Get metrics for an object (account, campaign, adset, or ad)
   *
   * @param objectIdOrName - Object identifier (can be resolved from account name)
   * @param level - Aggregation level
   * @param datePreset - Date preset
   * @param timeRange - Custom date range
   * @returns Formatted metrics
   */
  async getMetrics(
    objectIdOrName: string,
    level: 'account' | 'campaign' | 'adset' | 'ad' = 'account',
    datePreset?: string,
    timeRange?: { since: string; until: string }
  ): Promise<FormattedMetrics> {
    const objectId = await this.resolveObjectId(objectIdOrName);

    logger.info({ objectId, level, datePreset }, 'Fetching metrics');

    const insights = await this.client.getInsights(objectId, level, datePreset, timeRange);

    // Aggregate and format
    const formatted = this.formatInsights(insights);

    logger.info(
      {
        spend: formatted.spend,
        results: formatted.results,
        cpr: formatted.cpr,
      },
      'Metrics fetched'
    );

    return formatted;
  }

  /**
   * Get raw per-item insights for a non-account level (campaign, adset, or ad).
   *
   * Unlike getMetrics, this returns one entry per object instead of a single aggregate,
   * which allows callers to map metrics to individual campaigns, ad sets, or ads.
   */
  async getItemizedInsights(
    objectId: string,
    level: 'account' | 'campaign' | 'adset' | 'ad',
    datePreset?: string,
    timeRange?: { since: string; until: string }
  ): Promise<MetaInsights[]> {
    const resolvedId = await this.resolveObjectId(objectId);
    logger.info({ resolvedId, level, datePreset }, 'Fetching itemized insights');
    return this.client.getInsights(resolvedId, level, datePreset, timeRange);
  }

  /**
   * Compare two periods.
   *
   * Campaign comparisons use a fallback chain:
   * 1. Same campaign in the previous period
   * 2. Most similar campaign in the same account and previous period
   * 3. Account campaign average for the previous period
   */
  async compareTwoPeriods(
    objectIdOrName: string,
    level: 'account' | 'campaign' | 'adset' | 'ad',
    currentPeriod: string,
    previousPeriod: string
  ): Promise<PeriodComparison> {
    const objectId = await this.resolveObjectId(objectIdOrName);

    logger.info({ objectId, currentPeriod, previousPeriod }, 'Comparing periods');

    // Non-campaign objects are compared directly against the same object in the previous period.
    if (level !== 'campaign') {
      const [currentInsights, previousInsights] = await Promise.all([
        this.client.getInsights(objectId, level, currentPeriod),
        this.client.getInsights(objectId, level, previousPeriod),
      ]);

      return this.buildPeriodComparison(
        this.formatInsights(currentInsights),
        this.formatInsights(previousInsights),
        {
          basis: 'same_object',
          message: 'Compared the same object across both periods.',
        }
      );
    }

    // Campaign comparisons need metadata plus current and previous performance.
    const [currentCampaign, currentInsights, previousInsights] = await Promise.all([
      this.graphClient.getCampaign(objectId),
      this.client.getInsights(objectId, level, currentPeriod),
      this.client.getInsights(objectId, level, previousPeriod),
    ]);

    const current = this.formatInsights(currentInsights);

    // Prefer the exact same campaign when it has historical data.
    if (previousInsights.length > 0) {
      return this.buildPeriodComparison(current, this.formatInsights(previousInsights), {
        basis: 'same_campaign',
        message: 'Compared against the same campaign in the previous period.',
      });
    }

    const accountId = this.normalizeAccountId(currentCampaign.accountId);

    // The fallback chain depends on the parent account to inspect peer campaigns.
    if (!accountId) {
      return this.buildPeriodComparison(current, this.emptyMetrics(), {
        basis: 'no_reference',
        message:
          'The campaign had no data in the previous period and its account could not be resolved for fallbacks.',
      });
    }

    // Widen the search to the account so the service can evaluate similar campaigns
    // and, if necessary, a campaign-level account average.
    const [previousAccountCampaignInsights, accountCampaigns, accountAdSets] = await Promise.all([
      this.client.getInsights(accountId, 'campaign', previousPeriod),
      this.graphClient.getCampaigns(accountId, 'ALL'),
      this.graphClient.getAdSets(accountId, 'ALL'),
    ]);

    // First fallback: pick the most comparable campaign with historical data.
    const similarCampaign = this.findMostSimilarCampaign(
      currentCampaign,
      previousAccountCampaignInsights,
      accountCampaigns,
      accountAdSets
    );

    if (similarCampaign) {
      return this.buildPeriodComparison(current, this.formatInsights([similarCampaign.insight]), {
        basis: 'similar_campaign',
        message: `This campaign had no data in the previous period, so the comparison uses the most similar campaign: ${similarCampaign.campaign.name}.`,
        referenceCampaign: {
          id: similarCampaign.campaign.id,
          name: similarCampaign.campaign.name,
        },
      });
    }

    // Second fallback: use the account campaign average for the baseline period.
    if (previousAccountCampaignInsights.length > 0) {
      return this.buildPeriodComparison(
        current,
        this.buildCampaignAverageMetrics(previousAccountCampaignInsights),
        {
          basis: 'account_average',
          message:
            'This campaign had no data in the previous period and no similar campaign was found, so the comparison uses the account campaign average.',
        }
      );
    }

    // Last resort: there is no usable historical reference.
    return this.buildPeriodComparison(current, this.emptyMetrics(), {
      basis: 'no_reference',
      message:
        'No campaign data was available in the previous period, so the comparison falls back to a zero baseline.',
    });
  }

  /**
   * Get account summary with top campaigns
   */
  async getAccountSummary(
    accountIdOrName: string,
    datePreset: string = 'last_30d'
  ): Promise<AccountSummary> {
    // Get account info
    const account = await this.accountService.getAccount(accountIdOrName);

    // Get account-level metrics
    const metrics = await this.getMetrics(account.id, 'account', datePreset);

    // Get campaign-level metrics for top campaigns
    const campaignInsights = await this.client.getInsights(account.id, 'campaign', datePreset);

    // Sort by spend and take top 5
    const topCampaigns = campaignInsights
      .map((insight) => ({
        name: insight.campaignName || '',
        spend: insight.spend,
        results: this.calculateResults(insight),
      }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5);

    return {
      accountName: account.name,
      accountId: account.id,
      dateRange: metrics.dateRange,
      totals: metrics,
      topCampaigns,
      campaignsPaused: 0, // TODO: Count from campaign service
      campaignsActive: 0, // TODO: Count from campaign service
    };
  }

  /**
   * Format raw insights into readable metrics
   */
  private formatInsights(insights: MetaInsights[]): FormattedMetrics {
    if (insights.length === 0) {
      return this.emptyMetrics();
    }

    // Aggregate all insights
    const aggregated = insights.reduce(
      (acc, curr) => ({
        spend: acc.spend + curr.spend,
        impressions: acc.impressions + curr.impressions,
        clicks: acc.clicks + curr.clicks,
        ctr: 0, // Will recalculate
        cpc: 0, // Will recalculate
      }),
      { spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0 }
    );

    // Recalculate CTR
    if (aggregated.impressions > 0) {
      aggregated.ctr = (aggregated.clicks / aggregated.impressions) * 100;
    }

    // Calculate results (sum of all actions)
    const results = insights.reduce((sum, insight) => {
      return sum + this.calculateResults(insight);
    }, 0);

    // Calculate CPR (Cost Per Result)
    const cpr = results > 0 ? aggregated.spend / results : 0;

    // Format date range from first insight
    const firstInsight = insights[0];
    const dateRange =
      firstInsight.dateStart && firstInsight.dateStop
        ? `${firstInsight.dateStart} → ${firstInsight.dateStop}`
        : '';

    return {
      spend: aggregated.spend,
      results,
      cpr,
      impressions: aggregated.impressions,
      clicks: aggregated.clicks,
      ctr: Math.round(aggregated.ctr * 100) / 100, // Round to 2 decimals
      dateRange,
    };
  }

  private emptyMetrics(): FormattedMetrics {
    return {
      spend: 0,
      results: 0,
      cpr: 0,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      dateRange: '',
    };
  }

  /**
   * Calculate total results from actions, using the primary conversion event as the filter.
   *
   * When costPerActionType is present, its first entry identifies the campaign's primary
   * goal (e.g. purchase, lead). Only those actions are counted to avoid inflating results
   * with unrelated types like video views or page engagement.
   *
   * Falls back to summing all actions when no primary conversion type is available.
   */
  private calculateResults(insight: MetaInsights): number {
    if (!insight.actions || insight.actions.length === 0) {
      return 0;
    }

    const primaryActionType = insight.costPerActionType?.[0]?.actionType;

    if (primaryActionType) {
      return insight.actions
        .filter((a) => a.actionType === primaryActionType)
        .reduce((sum, a) => sum + parseInt(a.value, 10), 0);
    }

    return insight.actions.reduce((sum, action) => sum + parseInt(action.value, 10), 0);
  }

  private buildPeriodComparison(
    current: FormattedMetrics,
    previous: FormattedMetrics,
    reference: PeriodComparison['reference']
  ): PeriodComparison {
    return {
      current,
      previous,
      reference,
      changes: {
        spend: this.buildMetricChange(current.spend, previous.spend),
        results: this.buildMetricChange(current.results, previous.results),
        cpr: this.buildMetricChange(current.cpr, previous.cpr),
      },
    };
  }

  private async resolveObjectId(objectIdOrName: string): Promise<string> {
    if (objectIdOrName.startsWith('act_') || /^\d+$/.test(objectIdOrName)) {
      return objectIdOrName;
    }

    try {
      return await this.accountService.resolveAccount(objectIdOrName);
    } catch {
      logger.debug({ objectIdOrName }, 'Not an account name, using as ID');
      return objectIdOrName;
    }
  }

  private normalizeAccountId(accountId?: string): string | undefined {
    if (!accountId) {
      return undefined;
    }

    return accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  }

  private findMostSimilarCampaign(
    currentCampaign: Pick<
      MetaCampaign,
      'id' | 'name' | 'objective' | 'dailyBudget' | 'lifetimeBudget'
    >,
    previousInsights: MetaInsights[],
    accountCampaigns: Array<
      Pick<MetaCampaign, 'id' | 'name' | 'objective' | 'dailyBudget' | 'lifetimeBudget'>
    >,
    accountAdSets: MetaAdSet[]
  ): {
    insight: MetaInsights;
    campaign: Pick<MetaCampaign, 'id' | 'name' | 'objective' | 'dailyBudget' | 'lifetimeBudget'>;
  } | null {
    // Build comparable profiles from campaign metadata plus dominant ad set settings.
    const campaignsById = new Map(accountCampaigns.map((campaign) => [campaign.id, campaign]));
    const adSetsByCampaignId = this.groupAdSetsByCampaign(accountAdSets);
    const currentProfile = this.buildCampaignSimilarityProfile(
      currentCampaign,
      adSetsByCampaignId.get(currentCampaign.id) || []
    );

    // Without a dominant optimization goal, the service cannot enforce the hard similarity rules.
    if (!currentProfile.dominantOptimizationGoal) {
      return null;
    }

    // Start from campaigns with historical data, apply hard constraints, then rank survivors.
    const rankedCandidates = previousInsights
      .filter((insight) => Boolean(insight.campaignId) && insight.campaignId !== currentCampaign.id)
      .map((insight) => {
        const campaign = campaignsById.get(insight.campaignId!);

        if (!campaign) {
          return null;
        }

        const candidateProfile = this.buildCampaignSimilarityProfile(
          campaign,
          adSetsByCampaignId.get(campaign.id) || []
        );

        // Reject candidates that do not match the required business objective and optimization goal.
        if (!this.matchesRequiredCampaignSimilarity(currentProfile, candidateProfile)) {
          return null;
        }

        const nameSimilarity = this.calculateNameSimilarity(currentCampaign.name, campaign.name);
        const budgetSimilarity = this.calculateBudgetSimilarity(
          currentProfile.budget,
          candidateProfile.budget
        );
        const bidStrategyMatch = Number(
          this.hasExactDefinedMatch(currentProfile.bidStrategy, candidateProfile.bidStrategy)
        );
        const billingEventMatch = Number(
          this.hasExactDefinedMatch(currentProfile.billingEvent, candidateProfile.billingEvent)
        );

        return {
          insight,
          campaign,
          budgetSimilarity,
          bidStrategyMatch,
          billingEventMatch,
          nameSimilarity,
          // Budget dominates the score, while bidding settings refine the match and naming only breaks ties.
          score:
            budgetSimilarity * 0.6 +
            bidStrategyMatch * 0.25 +
            billingEventMatch * 0.1 +
            nameSimilarity * 0.05,
        };
      })
      .filter(
        (
          candidate
        ): candidate is {
          insight: MetaInsights;
          campaign: Pick<
            MetaCampaign,
            'id' | 'name' | 'objective' | 'dailyBudget' | 'lifetimeBudget'
          >;
          budgetSimilarity: number;
          bidStrategyMatch: number;
          billingEventMatch: number;
          nameSimilarity: number;
          score: number;
        } => candidate !== null
      )
      .sort((left, right) => right.score - left.score);

    return rankedCandidates[0] ?? null;
  }

  private calculateNameSimilarity(left: string, right: string): number {
    const leftTokens = this.tokenizeName(left);
    const rightTokens = this.tokenizeName(right);

    if (leftTokens.size === 0 || rightTokens.size === 0) {
      return 0;
    }

    // Jaccard-style overlap keeps the comparison simple and predictable.
    const sharedTokens = [...leftTokens].filter((token) => rightTokens.has(token)).length;
    const unionSize = new Set([...leftTokens, ...rightTokens]).size;

    return unionSize > 0 ? sharedTokens / unionSize : 0;
  }

  private tokenizeName(value: string): Set<string> {
    return new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length > 1)
    );
  }

  private groupAdSetsByCampaign(adSets: MetaAdSet[]): Map<string, MetaAdSet[]> {
    return adSets.reduce((grouped, adSet) => {
      const existing = grouped.get(adSet.campaignId) || [];
      existing.push(adSet);
      grouped.set(adSet.campaignId, existing);
      return grouped;
    }, new Map<string, MetaAdSet[]>());
  }

  private buildCampaignSimilarityProfile(
    campaign: Pick<MetaCampaign, 'objective' | 'dailyBudget' | 'lifetimeBudget'>,
    adSets: MetaAdSet[]
  ): CampaignSimilarityProfile {
    return {
      objective: campaign.objective,
      // Conversion intent is inferred from the dominant ad set optimization goal.
      dominantOptimizationGoal: this.getDominantValue(
        adSets.map((adSet) => adSet.optimizationGoal)
      ),
      // Pass ad sets so ABO campaigns (budget at ad set level) are not scored as zero-budget.
      budget: this.resolveCampaignBudget(campaign, adSets),
      bidStrategy: this.getDominantValue(adSets.map((adSet) => adSet.bidStrategy)),
      billingEvent: this.getDominantValue(adSets.map((adSet) => adSet.billingEvent)),
    };
  }

  private matchesRequiredCampaignSimilarity(
    current: CampaignSimilarityProfile,
    candidate: CampaignSimilarityProfile
  ): boolean {
    // Only objective and dominant optimization goal are hard similarity requirements.
    return (
      current.objective === candidate.objective &&
      Boolean(current.dominantOptimizationGoal) &&
      current.dominantOptimizationGoal === candidate.dominantOptimizationGoal
    );
  }

  private calculateBudgetSimilarity(currentBudget?: number, candidateBudget?: number): number {
    if (!currentBudget || !candidateBudget || currentBudget <= 0 || candidateBudget <= 0) {
      return 0;
    }

    // Use a symmetric ratio so 100 vs 80 scores the same as 80 vs 100.
    const larger = Math.max(currentBudget, candidateBudget);
    const smaller = Math.min(currentBudget, candidateBudget);

    return smaller / larger;
  }

  private resolveCampaignBudget(
    campaign: Pick<MetaCampaign, 'dailyBudget' | 'lifetimeBudget'>,
    adSets: MetaAdSet[] = []
  ): number | undefined {
    // Campaign-level budget (CBO) takes precedence.
    if (campaign.dailyBudget) return campaign.dailyBudget;
    if (campaign.lifetimeBudget) return campaign.lifetimeBudget;

    // For ABO campaigns (budget lives at the ad set level), aggregate ad set budgets
    // as a proxy so similarity scoring has a comparable value to work with.
    const adSetDailyTotal = adSets.reduce((sum, a) => sum + (a.dailyBudget ?? 0), 0);
    if (adSetDailyTotal > 0) return adSetDailyTotal;

    const adSetLifetimeTotal = adSets.reduce((sum, a) => sum + (a.lifetimeBudget ?? 0), 0);
    if (adSetLifetimeTotal > 0) return adSetLifetimeTotal;

    return undefined;
  }

  private hasExactDefinedMatch(left?: string, right?: string): boolean {
    // Missing values do not count as a positive match.
    return Boolean(left) && left === right;
  }

  private getDominantValue(values: Array<string | undefined>): string | undefined {
    const counts = new Map<string, number>();

    for (const value of values) {
      if (!value) {
        continue;
      }

      counts.set(value, (counts.get(value) || 0) + 1);
    }

    let dominantValue: string | undefined;
    let dominantCount = 0;

    for (const [value, count] of counts.entries()) {
      if (count > dominantCount) {
        dominantValue = value;
        dominantCount = count;
      }
    }

    return dominantValue;
  }

  private buildCampaignAverageMetrics(insights: MetaInsights[]): FormattedMetrics {
    if (insights.length === 0) {
      return this.emptyMetrics();
    }

    const count = insights.length;
    const totals = insights.reduce(
      (acc, insight) => {
        const results = this.calculateResults(insight);
        // Average CPR is computed per-campaign first, then averaged, so the fallback
        // behaves like a benchmark campaign instead of a fully aggregated account total.
        const cpr = results > 0 ? insight.spend / results : 0;

        return {
          spend: acc.spend + insight.spend,
          results: acc.results + results,
          cpr: acc.cpr + cpr,
          impressions: acc.impressions + insight.impressions,
          clicks: acc.clicks + insight.clicks,
          ctr: acc.ctr + insight.ctr,
        };
      },
      { spend: 0, results: 0, cpr: 0, impressions: 0, clicks: 0, ctr: 0 }
    );

    const firstInsight = insights[0];
    const dateRange =
      firstInsight.dateStart && firstInsight.dateStop
        ? `${firstInsight.dateStart} → ${firstInsight.dateStop}`
        : '';

    return {
      spend: totals.spend / count,
      results: Math.round((totals.results / count) * 100) / 100,
      cpr: Math.round((totals.cpr / count) * 100) / 100,
      impressions: Math.round(totals.impressions / count),
      clicks: Math.round(totals.clicks / count),
      ctr: Math.round((totals.ctr / count) * 100) / 100,
      dateRange,
    };
  }

  private buildMetricChange(current: number, previous: number): MetricChange {
    const absolute = current - previous;
    const percentage = previous > 0 ? (absolute / previous) * 100 : 0;
    const direction = current > previous ? 'up' : current < previous ? 'down' : 'same';

    return {
      absolute,
      percentage: Math.round(percentage * 100) / 100,
      direction,
      significant: Math.abs(percentage) >= SIGNIFICANT_CHANGE_THRESHOLD,
    };
  }
}
