import { describe, expect, it, vi, beforeEach } from 'vitest';
import { InsightsService } from '../services/insights-service.js';
import type { AccountService } from '../services/account-service.js';
import type { MetaAdSet, MetaCampaign, MetaInsights } from '../types/index.js';

// Access private methods for unit testing via type cast.
type InsightsServicePrivate = {
  calculateResults: (insight: MetaInsights) => number;
  findMostSimilarCampaign: (
    current: Pick<MetaCampaign, 'id' | 'name' | 'objective' | 'dailyBudget' | 'lifetimeBudget'>,
    previousInsights: MetaInsights[],
    accountCampaigns: Array<
      Pick<MetaCampaign, 'id' | 'name' | 'objective' | 'dailyBudget' | 'lifetimeBudget'>
    >,
    accountAdSets: MetaAdSet[]
  ) => {
    insight: MetaInsights;
    campaign: Pick<MetaCampaign, 'id' | 'name' | 'objective' | 'dailyBudget' | 'lifetimeBudget'>;
  } | null;
};

function createInsight(input: Partial<MetaInsights> & Pick<MetaInsights, 'spend'>): MetaInsights {
  return {
    spend: input.spend,
    impressions: input.impressions ?? 1000,
    clicks: input.clicks ?? 100,
    ctr: input.ctr ?? 10,
    cpc: input.cpc ?? 100,
    actions: input.actions ?? [{ actionType: 'lead', value: '10' }],
    costPerActionType: input.costPerActionType,
    dateStart: input.dateStart ?? '2026-03-01',
    dateStop: input.dateStop ?? '2026-03-07',
    campaignId: input.campaignId,
    campaignName: input.campaignName,
    adsetId: input.adsetId,
    adsetName: input.adsetName,
    adId: input.adId,
    adName: input.adName,
  };
}

function createCampaign(
  input: Partial<MetaCampaign> & Pick<MetaCampaign, 'id' | 'name' | 'objective'>
) {
  return {
    id: input.id,
    name: input.name,
    objective: input.objective,
    status: input.status ?? 'ACTIVE',
    dailyBudget: input.dailyBudget,
    lifetimeBudget: input.lifetimeBudget,
    createdTime: input.createdTime ?? '2026-03-01T00:00:00+0000',
  };
}

describe('InsightsService.calculateResults', () => {
  const accountService = {} as AccountService;
  let service: InsightsServicePrivate;

  beforeEach(() => {
    service = new InsightsService('token', accountService) as unknown as InsightsServicePrivate;
  });

  it('counts only the primary action type when costPerActionType is present', () => {
    const insight = createInsight({
      spend: 10000,
      actions: [
        { actionType: 'purchase', value: '5' },
        { actionType: 'video_view', value: '1000' },
        { actionType: 'post_engagement', value: '500' },
      ],
      costPerActionType: [{ actionType: 'purchase', value: '2000' }],
    });

    expect(service.calculateResults(insight)).toBe(5);
  });

  it('falls back to summing all actions when costPerActionType is absent', () => {
    const insight = createInsight({
      spend: 10000,
      actions: [
        { actionType: 'lead', value: '10' },
        { actionType: 'other', value: '3' },
      ],
    });

    expect(service.calculateResults(insight)).toBe(13);
  });

  it('returns 0 when actions array is empty', () => {
    const insight = createInsight({ spend: 5000, actions: [] });
    expect(service.calculateResults(insight)).toBe(0);
  });
});

describe('InsightsService budget similarity with ABO campaigns', () => {
  const accountService = {} as AccountService;
  let service: InsightsServicePrivate;

  beforeEach(() => {
    service = new InsightsService('token', accountService) as unknown as InsightsServicePrivate;
  });

  it('finds similar campaign when budget is at ad set level (ABO)', () => {
    // ABO campaign: no budget on the campaign object, budget lives in the ad set.
    const currentCampaign = createCampaign({
      id: '100',
      name: 'Summer Leads',
      objective: 'OUTCOME_LEADS',
      dailyBudget: undefined,
      lifetimeBudget: undefined,
    });

    const candidateCampaign = createCampaign({
      id: '200',
      name: 'Spring Leads',
      objective: 'OUTCOME_LEADS',
      dailyBudget: undefined,
      lifetimeBudget: undefined,
    });

    const previousInsights: MetaInsights[] = [
      createInsight({
        campaignId: '200',
        campaignName: 'Spring Leads',
        spend: 8000,
        actions: [{ actionType: 'lead', value: '8' }],
        costPerActionType: [{ actionType: 'lead', value: '1000' }],
      }),
    ];

    // Ad sets have the budget — both campaigns have ~10000 daily at the ad set level.
    const accountAdSets: MetaAdSet[] = [
      {
        id: 'as-100',
        name: 'Summer Ad Set',
        campaignId: '100',
        status: 'ACTIVE',
        dailyBudget: 10000,
        optimizationGoal: 'LEAD_GENERATION',
        bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
        billingEvent: 'IMPRESSIONS',
      },
      {
        id: 'as-200',
        name: 'Spring Ad Set',
        campaignId: '200',
        status: 'ACTIVE',
        dailyBudget: 9500,
        optimizationGoal: 'LEAD_GENERATION',
        bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
        billingEvent: 'IMPRESSIONS',
      },
    ];

    const result = service.findMostSimilarCampaign(
      currentCampaign,
      previousInsights,
      [candidateCampaign],
      accountAdSets
    );

    // Should find the candidate instead of scoring it zero for having no campaign budget.
    expect(result).not.toBeNull();
    expect(result?.campaign.id).toBe('200');
  });
});

describe('InsightsService.compareTwoPeriods', () => {
  const resolveAccount = vi.fn();
  const accountService = { resolveAccount } as unknown as AccountService;

  let service: InsightsService;
  let getInsights: ReturnType<typeof vi.fn>;
  let getCampaign: ReturnType<typeof vi.fn>;
  let getCampaigns: ReturnType<typeof vi.fn>;
  let getAdSets: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resolveAccount.mockReset();
    getInsights = vi.fn();
    getCampaign = vi.fn();
    getCampaigns = vi.fn();
    getAdSets = vi.fn();

    service = new InsightsService('token', accountService);

    const internal = service as unknown as {
      client: { getInsights: typeof getInsights };
      graphClient: {
        getCampaign: typeof getCampaign;
        getCampaigns: typeof getCampaigns;
        getAdSets: typeof getAdSets;
      };
    };

    internal.client = { getInsights };
    internal.graphClient = { getCampaign, getCampaigns, getAdSets };
  });

  it('uses the same campaign when previous-period data exists', async () => {
    const currentCampaign = {
      ...createCampaign({
        id: '123',
        name: 'Spring Leads',
        objective: 'OUTCOME_LEADS',
        dailyBudget: 10000,
      }),
      accountId: '456',
    };
    const currentInsights = [
      createInsight({
        campaignId: '123',
        spend: 10000,
        actions: [{ actionType: 'lead', value: '10' }],
      }),
    ];
    const previousInsights = [
      createInsight({
        campaignId: '123',
        spend: 8000,
        actions: [{ actionType: 'lead', value: '8' }],
        dateStart: '2026-02-22',
        dateStop: '2026-02-28',
      }),
    ];

    getCampaign.mockResolvedValue(currentCampaign);
    getInsights.mockImplementation(async (objectId: string, level: string, period: string) => {
      if (objectId === '123' && level === 'campaign' && period === 'last_7d') {
        return currentInsights;
      }

      if (objectId === '123' && level === 'campaign' && period === 'last_month') {
        return previousInsights;
      }

      return [];
    });

    const result = await service.compareTwoPeriods('123', 'campaign', {
      currentPeriod: { datePreset: 'last_7d' },
      previousPeriod: { datePreset: 'last_month' },
    });

    expect(result.requestedMetrics).toEqual(['spend', 'results', 'cpr']);
    expect(result.reference.basis).toBe('same_campaign');
    expect(result.resultDefinition).toEqual({
      requestedMode: 'primary_from_insights',
      requestedActionType: null,
      resolvedMode: 'all_actions',
      resolvedActionType: null,
      resolutionSource: 'all_actions_fallback',
      message:
        'No explicit primary action type was available in the insights, so results sum all action types across both periods.',
    });
    expect(result.previous.spend).toBe(8000);
    expect(result.previous.results).toBe(8);
    expect(getCampaigns).not.toHaveBeenCalled();
    expect(getAdSets).not.toHaveBeenCalled();
  });

  it('falls back to the most similar campaign when the original campaign has no previous data', async () => {
    const currentCampaign = {
      ...createCampaign({
        id: '123',
        name: 'Spring Leads Prospecting',
        objective: 'OUTCOME_LEADS',
        dailyBudget: 10000,
      }),
      accountId: '456',
    };
    const similarCampaign = createCampaign({
      id: '999',
      name: 'Spring Leads Retargeting',
      objective: 'OUTCOME_LEADS',
      dailyBudget: 9500,
    });
    const nonMatchingCampaign = createCampaign({
      id: '888',
      name: 'Traffic Booster',
      objective: 'OUTCOME_TRAFFIC',
      dailyBudget: 9800,
    });

    const accountAdSets: MetaAdSet[] = [
      {
        id: 'adset-current',
        name: 'Current Ad Set',
        campaignId: '123',
        status: 'ACTIVE',
        optimizationGoal: 'OFFSITE_CONVERSIONS',
        bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
        billingEvent: 'IMPRESSIONS',
      },
      {
        id: 'adset-similar',
        name: 'Similar Ad Set',
        campaignId: '999',
        status: 'ACTIVE',
        optimizationGoal: 'OFFSITE_CONVERSIONS',
        bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
        billingEvent: 'IMPRESSIONS',
      },
      {
        id: 'adset-other',
        name: 'Other Ad Set',
        campaignId: '888',
        status: 'ACTIVE',
        optimizationGoal: 'LINK_CLICKS',
        bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
        billingEvent: 'IMPRESSIONS',
      },
    ];

    const currentInsights = [
      createInsight({
        campaignId: '123',
        spend: 12000,
        actions: [{ actionType: 'lead', value: '12' }],
      }),
    ];
    const accountPreviousInsights = [
      createInsight({
        campaignId: '999',
        campaignName: 'Spring Leads Retargeting',
        spend: 9000,
        actions: [{ actionType: 'lead', value: '9' }],
        dateStart: '2026-02-22',
        dateStop: '2026-02-28',
      }),
      createInsight({
        campaignId: '888',
        campaignName: 'Traffic Booster',
        spend: 5000,
        actions: [{ actionType: 'lead', value: '5' }],
        dateStart: '2026-02-22',
        dateStop: '2026-02-28',
      }),
    ];

    getCampaign.mockResolvedValue(currentCampaign);
    getCampaigns.mockResolvedValue([similarCampaign, nonMatchingCampaign]);
    getAdSets.mockResolvedValue(accountAdSets);
    getInsights.mockImplementation(async (objectId: string, level: string, period: string) => {
      if (objectId === '123' && level === 'campaign' && period === 'last_7d') {
        return currentInsights;
      }

      if (objectId === '123' && level === 'campaign' && period === 'last_month') {
        return [];
      }

      if (objectId === 'act_456' && level === 'campaign' && period === 'last_month') {
        return accountPreviousInsights;
      }

      return [];
    });

    const result = await service.compareTwoPeriods('123', 'campaign', {
      currentPeriod: { datePreset: 'last_7d' },
      previousPeriod: { datePreset: 'last_month' },
    });

    expect(result.requestedMetrics).toEqual(['spend', 'results', 'cpr']);
    expect(result.reference.basis).toBe('similar_campaign');
    expect(result.reference.referenceCampaign).toEqual({
      id: '999',
      name: 'Spring Leads Retargeting',
    });
    expect(result.previous.spend).toBe(9000);
    expect(result.previous.results).toBe(9);
  });

  it('falls back to the account campaign average when no similar campaign qualifies', async () => {
    const currentCampaign = {
      ...createCampaign({
        id: '123',
        name: 'Spring Leads Prospecting',
        objective: 'OUTCOME_LEADS',
        dailyBudget: 10000,
      }),
      accountId: '456',
    };

    const accountCampaigns = [
      createCampaign({
        id: '999',
        name: 'Traffic Booster',
        objective: 'OUTCOME_TRAFFIC',
        dailyBudget: 10000,
      }),
      createCampaign({
        id: '888',
        name: 'Awareness Push',
        objective: 'OUTCOME_AWARENESS',
        dailyBudget: 12000,
      }),
    ];

    const accountAdSets: MetaAdSet[] = [
      {
        id: 'adset-current',
        name: 'Current Ad Set',
        campaignId: '123',
        status: 'ACTIVE',
        optimizationGoal: 'OFFSITE_CONVERSIONS',
        bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
        billingEvent: 'IMPRESSIONS',
      },
      {
        id: 'adset-999',
        name: 'Traffic Ad Set',
        campaignId: '999',
        status: 'ACTIVE',
        optimizationGoal: 'LINK_CLICKS',
      },
      {
        id: 'adset-888',
        name: 'Awareness Ad Set',
        campaignId: '888',
        status: 'ACTIVE',
        optimizationGoal: 'REACH',
      },
    ];

    const currentInsights = [
      createInsight({
        campaignId: '123',
        spend: 15000,
        actions: [{ actionType: 'lead', value: '15' }],
      }),
    ];
    const accountPreviousInsights = [
      createInsight({
        campaignId: '999',
        spend: 10000,
        actions: [{ actionType: 'lead', value: '10' }],
        impressions: 2000,
        clicks: 100,
        ctr: 5,
      }),
      createInsight({
        campaignId: '888',
        spend: 20000,
        actions: [{ actionType: 'lead', value: '20' }],
        impressions: 4000,
        clicks: 200,
        ctr: 5,
      }),
    ];

    getCampaign.mockResolvedValue(currentCampaign);
    getCampaigns.mockResolvedValue(accountCampaigns);
    getAdSets.mockResolvedValue(accountAdSets);
    getInsights.mockImplementation(async (objectId: string, level: string, period: string) => {
      if (objectId === '123' && level === 'campaign' && period === 'last_7d') {
        return currentInsights;
      }

      if (objectId === '123' && level === 'campaign' && period === 'last_month') {
        return [];
      }

      if (objectId === 'act_456' && level === 'campaign' && period === 'last_month') {
        return accountPreviousInsights;
      }

      return [];
    });

    const result = await service.compareTwoPeriods('123', 'campaign', {
      currentPeriod: { datePreset: 'last_7d' },
      previousPeriod: { datePreset: 'last_month' },
    });

    expect(result.requestedMetrics).toEqual(['spend', 'results', 'cpr']);
    expect(result.reference.basis).toBe('account_average');
    expect(result.previous.spend).toBe(15000);
    expect(result.previous.results).toBe(15);
    expect(result.previous.cpr).toBe(1000);
  });

  it('applies a specific action type consistently across both periods', async () => {
    const currentCampaign = {
      ...createCampaign({
        id: '123',
        name: 'Spring Leads',
        objective: 'OUTCOME_LEADS',
        dailyBudget: 10000,
      }),
      accountId: '456',
    };
    const currentInsights = [
      createInsight({
        campaignId: '123',
        spend: 10000,
        actions: [
          { actionType: 'lead', value: '10' },
          { actionType: 'purchase', value: '2' },
        ],
        costPerActionType: [{ actionType: 'lead', value: '1000' }],
      }),
    ];
    const previousInsights = [
      createInsight({
        campaignId: '123',
        spend: 6000,
        actions: [
          { actionType: 'lead', value: '5' },
          { actionType: 'purchase', value: '1' },
        ],
        costPerActionType: [{ actionType: 'purchase', value: '6000' }],
      }),
    ];

    getCampaign.mockResolvedValue(currentCampaign);
    getInsights.mockImplementation(async (objectId: string, level: string, period: string) => {
      if (objectId === '123' && level === 'campaign' && period === 'last_7d') {
        return currentInsights;
      }

      if (objectId === '123' && level === 'campaign' && period === 'last_month') {
        return previousInsights;
      }

      return [];
    });

    const result = await service.compareTwoPeriods('123', 'campaign', {
      currentPeriod: { datePreset: 'last_7d' },
      previousPeriod: { datePreset: 'last_month' },
      resultMode: 'specific_action',
      resultActionType: 'purchase',
    });

    expect(result.requestedMetrics).toEqual(['spend', 'results', 'cpr']);
    expect(result.resultDefinition).toEqual({
      requestedMode: 'specific_action',
      requestedActionType: 'purchase',
      resolvedMode: 'specific_action',
      resolvedActionType: 'purchase',
      resolutionSource: 'requested_specific_action',
      message: 'Results use the explicit action type "purchase" across both periods.',
    });
    expect(result.current.results).toBe(2);
    expect(result.previous.results).toBe(1);
    expect(result.current.cpr).toBe(5000);
    expect(result.previous.cpr).toBe(6000);
  });

  it('supports mixed presets and custom time ranges for non-campaign comparisons', async () => {
    getInsights.mockImplementation(
      async (
        objectId: string,
        level: string,
        datePreset?: string,
        timeRange?: { since: string; until: string }
      ) => {
        if (
          objectId === '123' &&
          level === 'adset' &&
          timeRange?.since === '2026-03-01' &&
          timeRange?.until === '2026-03-07'
        ) {
          return [
            createInsight({
              spend: 4000,
              actions: [{ actionType: 'lead', value: '4' }],
              costPerActionType: [{ actionType: 'lead', value: '1000' }],
            }),
          ];
        }

        if (objectId === '123' && level === 'adset' && datePreset === 'last_month') {
          return [
            createInsight({
              spend: 2000,
              actions: [{ actionType: 'lead', value: '2' }],
              costPerActionType: [{ actionType: 'lead', value: '1000' }],
            }),
          ];
        }

        return [];
      }
    );

    const result = await service.compareTwoPeriods('123', 'adset', {
      currentPeriod: {
        timeRange: { since: '2026-03-01', until: '2026-03-07' },
      },
      previousPeriod: { datePreset: 'last_month' },
    });

    expect(result.requestedMetrics).toEqual(['spend', 'results', 'cpr']);
    expect(result.reference.basis).toBe('same_object');
    expect(result.resultDefinition).toEqual({
      requestedMode: 'primary_from_insights',
      requestedActionType: null,
      resolvedMode: 'specific_action',
      resolvedActionType: 'lead',
      resolutionSource: 'current_primary_action',
      message: 'Results use the current period primary action type "lead" across both periods.',
    });
    expect(result.current.results).toBe(4);
    expect(result.previous.results).toBe(2);
    expect(getInsights).toHaveBeenCalledWith('123', 'adset', undefined, {
      since: '2026-03-01',
      until: '2026-03-07',
    });
    expect(getInsights).toHaveBeenCalledWith('123', 'adset', 'last_month', undefined);
  });

  it('returns no_reference with zero baseline when no historical data exists anywhere', async () => {
    // This is the last-resort path: campaign has no previous data AND the account
    // has zero campaign insights in the previous period. The service must not throw —
    // it returns a zero baseline and documents why via basis: 'no_reference'.
    const currentCampaign = {
      ...createCampaign({
        id: '123',
        name: 'Brand New Campaign',
        objective: 'OUTCOME_LEADS',
        dailyBudget: 10000,
      }),
      accountId: '456',
    };

    const currentInsights = [
      createInsight({
        campaignId: '123',
        spend: 5000,
        actions: [{ actionType: 'lead', value: '5' }],
      }),
    ];

    getCampaign.mockResolvedValue(currentCampaign);
    getCampaigns.mockResolvedValue([]);
    getAdSets.mockResolvedValue([]);
    getInsights.mockImplementation(async (objectId: string, level: string, period?: string) => {
      if (objectId === '123' && level === 'campaign' && period === 'last_7d') {
        return currentInsights;
      }
      // No data anywhere in the previous period
      return [];
    });

    const result = await service.compareTwoPeriods('123', 'campaign', {
      currentPeriod: { datePreset: 'last_7d' },
      previousPeriod: { datePreset: 'last_month' },
    });

    expect(result.reference.basis).toBe('no_reference');
    expect(result.previous.spend).toBe(0);
    expect(result.previous.results).toBe(0);
    // Changes should still be computed relative to zero
    expect(result.changes.spend).toBeDefined();
  });

  it('returns no_reference when the campaign accountId cannot be resolved', async () => {
    // When accountId is missing from the campaign object, the service cannot
    // run the fallback chain and must return no_reference immediately.
    const currentCampaign = createCampaign({
      id: '123',
      name: 'Orphan Campaign',
      objective: 'OUTCOME_LEADS',
      // accountId intentionally absent
    });

    const currentInsights = [
      createInsight({
        campaignId: '123',
        spend: 3000,
        actions: [{ actionType: 'lead', value: '3' }],
      }),
    ];

    getCampaign.mockResolvedValue(currentCampaign);
    getInsights.mockImplementation(async (objectId: string, level: string, period?: string) => {
      if (objectId === '123' && level === 'campaign' && period === 'last_7d') {
        return currentInsights;
      }
      return [];
    });

    const result = await service.compareTwoPeriods('123', 'campaign', {
      currentPeriod: { datePreset: 'last_7d' },
      previousPeriod: { datePreset: 'last_month' },
    });

    expect(result.reference.basis).toBe('no_reference');
    expect(result.reference.message).toContain('account could not be resolved');
    expect(result.previous.spend).toBe(0);
    // The fallback chain should not have been invoked at all
    expect(getCampaigns).not.toHaveBeenCalled();
    expect(getAdSets).not.toHaveBeenCalled();
  });

  it('limits metric changes to the requested metric set', async () => {
    getInsights.mockImplementation(async (objectId: string, level: string, period?: string) => {
      if (objectId === '123' && level === 'ad' && period === 'last_7d') {
        return [
          createInsight({
            spend: 3000,
            impressions: 1500,
            clicks: 75,
            ctr: 5,
            actions: [{ actionType: 'lead', value: '3' }],
          }),
        ];
      }

      if (objectId === '123' && level === 'ad' && period === 'last_month') {
        return [
          createInsight({
            spend: 2000,
            impressions: 1000,
            clicks: 40,
            ctr: 4,
            actions: [{ actionType: 'lead', value: '2' }],
          }),
        ];
      }

      return [];
    });

    const result = await service.compareTwoPeriods('123', 'ad', {
      currentPeriod: { datePreset: 'last_7d' },
      previousPeriod: { datePreset: 'last_month' },
      metrics: ['impressions', 'clicks', 'ctr'],
    });

    expect(result.requestedMetrics).toEqual(['impressions', 'clicks', 'ctr']);
    expect(result.changes).toEqual({
      impressions: {
        absolute: 500,
        percentage: 50,
        direction: 'up',
        significant: true,
      },
      clicks: {
        absolute: 35,
        percentage: 87.5,
        direction: 'up',
        significant: true,
      },
      ctr: {
        absolute: 1,
        percentage: 25,
        direction: 'up',
        significant: true,
      },
    });
    expect(result.changes.spend).toBeUndefined();
  });
});

describe('InsightsService.getItemizedInsights', () => {
  const resolveAccount = vi.fn();
  const accountService = { resolveAccount } as unknown as AccountService;

  let service: InsightsService;
  let getInsights: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resolveAccount.mockReset();
    getInsights = vi.fn();
    service = new InsightsService('token', accountService);

    const internal = service as unknown as {
      client: { getInsights: typeof getInsights };
    };

    internal.client = { getInsights };
  });

  it('returns normalized ids/names plus results and cpr for itemized levels', async () => {
    getInsights.mockResolvedValue([
      createInsight({
        campaignId: 'cmp_1',
        campaignName: 'Campaign 1',
        adsetId: 'adset_1',
        adsetName: 'Ad Set 1',
        spend: 2400,
        actions: [{ actionType: 'lead', value: '6' }],
        costPerActionType: [{ actionType: 'lead', value: '400' }],
      }),
    ]);

    const result = await service.getItemizedInsights('cmp_1', 'adset', 'last_7d');

    expect(result).toEqual([
      {
        level: 'adset',
        id: 'adset_1',
        name: 'Ad Set 1',
        campaignId: 'cmp_1',
        campaignName: 'Campaign 1',
        adsetId: 'adset_1',
        adsetName: 'Ad Set 1',
        adId: undefined,
        adName: undefined,
        spend: 2400,
        results: 6,
        cpr: 400,
        impressions: 1000,
        clicks: 100,
        ctr: 10,
        cpm: undefined,
        cpp: undefined,
        actions: [{ actionType: 'lead', value: '6' }],
        costPerActionType: [{ actionType: 'lead', value: '400' }],
        dateStart: '2026-03-01',
        dateStop: '2026-03-07',
        dateRange: '2026-03-01 → 2026-03-07',
      },
    ]);
  });
});
