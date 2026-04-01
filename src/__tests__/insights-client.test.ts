import { describe, expect, it, vi } from 'vitest';
import { InsightsClient } from '../api/insights-client.js';

describe('InsightsClient.getInsights', () => {
  it('maps ad set and ad ids from the Meta response', async () => {
    const client = new InsightsClient('token');
    const get = vi.fn().mockResolvedValue({
      data: [
        {
          campaign_id: 'cmp_1',
          campaign_name: 'Campaign 1',
          adset_id: 'adset_1',
          adset_name: 'Ad Set 1',
          ad_id: 'ad_1',
          ad_name: 'Ad 1',
          spend: '1234',
          impressions: '1000',
          clicks: '25',
          ctr: '2.5',
          cpc: '49.36',
          cpm: '123.4',
          cpp: '61.7',
          actions: [{ action_type: 'lead', value: '5' }],
          cost_per_action_type: [{ action_type: 'lead', value: '246.8' }],
          date_start: '2026-03-01',
          date_stop: '2026-03-07',
        },
      ],
    });

    (client as unknown as { get: typeof get }).get = get;

    const result = await client.getInsights('act_123', 'ad');

    expect(get).toHaveBeenCalledOnce();
    expect(result).toEqual([
      {
        campaignId: 'cmp_1',
        campaignName: 'Campaign 1',
        adsetId: 'adset_1',
        adsetName: 'Ad Set 1',
        adId: 'ad_1',
        adName: 'Ad 1',
        spend: 1234,
        impressions: 1000,
        clicks: 25,
        ctr: 2.5,
        cpc: 49.36,
        cpm: 123.4,
        cpp: 61.7,
        actions: [{ actionType: 'lead', value: '5' }],
        costPerActionType: [{ actionType: 'lead', value: '246.8' }],
        dateStart: '2026-03-01',
        dateStop: '2026-03-07',
      },
    ]);
  });
});
