import { describe, expect, it, vi, beforeEach } from 'vitest';
import { InsightsService } from '../services/insights-service.js';
import type { AccountService } from '../services/account-service.js';
import type { MetaAdSet, MetaCampaign, MetaInsights } from '../types/index.js';

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
    adsetName: input.adsetName,
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

    const result = await service.compareTwoPeriods('123', 'campaign', 'last_7d', 'last_month');

    expect(result.reference.basis).toBe('same_campaign');
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

    const result = await service.compareTwoPeriods('123', 'campaign', 'last_7d', 'last_month');

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

    const result = await service.compareTwoPeriods('123', 'campaign', 'last_7d', 'last_month');

    expect(result.reference.basis).toBe('account_average');
    expect(result.previous.spend).toBe(15000);
    expect(result.previous.results).toBe(15);
    expect(result.previous.cpr).toBe(1000);
  });
});
