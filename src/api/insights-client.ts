/**
 * Insights API Client
 *
 * Obtiene métricas de rendimiento de cuentas, campañas, adsets y ads.
 * Endpoint: /{object-id}/insights
 */

import { MetaApiClient } from './base-client.js';
import type { MetaInsights } from '../types/index.js';

interface InsightsResponse {
  data: Array<{
    campaign_id?: string;
    campaign_name?: string;
    adset_id?: string;
    adset_name?: string;
    ad_id?: string;
    ad_name?: string;
    impressions?: string;
    clicks?: string;
    spend?: string;
    ctr?: string;
    cpc?: string;
    cpm?: string;
    cpp?: string;
    reach?: string;
    frequency?: string;
    actions?: Array<{ action_type: string; value: string }>;
    cost_per_action_type?: Array<{ action_type: string; value: string }>;
    conversions?: Array<{ action_name: string; value: string }>;
    cost_per_conversion?: Array<{ action_name: string; value: string }>;
    date_start?: string;
    date_stop?: string;
  }>;
  paging?: {
    cursors?: {
      after?: string;
    };
    next?: string;
  };
}

export class InsightsClient extends MetaApiClient {
  /**
   * Get performance insights for an object
   *
   * Endpoint: GET /{object-id}/insights
   *
   * @param objectId - Account, campaign, adset, or ad ID
   * @param level - Aggregation level (account, campaign, adset, ad)
   * @param datePreset - Predefined date range
   * @param timeRange - Custom date range {since, until}
   * @param breakdowns - Optional breakdown dimensions
   * @returns Insights data
   */
  async getInsights(
    objectId: string,
    level: 'account' | 'campaign' | 'adset' | 'ad' = 'campaign',
    datePreset?: string,
    timeRange?: { since: string; until: string },
    breakdowns?: string[]
  ): Promise<MetaInsights[]> {
    const fields = [
      'campaign_id',
      'campaign_name',
      'adset_id',
      'adset_name',
      'ad_id',
      'ad_name',
      'impressions',
      'clicks',
      'spend',
      'ctr',
      'cpc',
      'cpm',
      'cpp',
      'reach',
      'frequency',
      'actions',
      'cost_per_action_type',
      'conversions',
      'cost_per_conversion',
      'date_start',
      'date_stop',
    ].join(',');

    const params: Record<string, string | object> = {
      fields,
      level,
      limit: '100',
    };

    // Date range: use timeRange if provided, otherwise datePreset
    if (timeRange) {
      params.time_range = JSON.stringify(timeRange);
    } else if (datePreset) {
      params.date_preset = datePreset;
    } else {
      // Default to yesterday
      params.date_preset = 'yesterday';
    }

    // Optional breakdowns
    if (breakdowns && breakdowns.length > 0) {
      params.breakdowns = breakdowns.join(',');
    }

    const response = await this.get<InsightsResponse>(`${objectId}/insights`, params);

    // Transform Meta API format to our internal format
    return response.data.map((insight) => {
      // Parse actions into a simpler format
      const actions =
        insight.actions?.map((a) => ({
          actionType: a.action_type,
          value: a.value,
        })) || [];

      const costPerActionType =
        insight.cost_per_action_type?.map((a) => ({
          actionType: a.action_type,
          value: a.value,
        })) || [];

      return {
        campaignId: insight.campaign_id,
        campaignName: insight.campaign_name,
        adsetId: insight.adset_id,
        adsetName: insight.adset_name,
        adId: insight.ad_id,
        adName: insight.ad_name,
        spend: insight.spend ? parseFloat(insight.spend) : 0,
        // Meta returns integer strings for impressions and clicks, but Math.round guards
        // against any edge cases where the API returns a fractional string.
        impressions: insight.impressions ? Math.round(Number(insight.impressions)) : 0,
        clicks: insight.clicks ? Math.round(Number(insight.clicks)) : 0,
        ctr: insight.ctr ? parseFloat(insight.ctr) : 0,
        cpc: insight.cpc ? parseFloat(insight.cpc) : 0,
        cpm: insight.cpm ? parseFloat(insight.cpm) : undefined,
        cpp: insight.cpp ? parseFloat(insight.cpp) : undefined,
        actions: actions.length > 0 ? actions : undefined,
        costPerActionType: costPerActionType.length > 0 ? costPerActionType : undefined,
        dateStart: insight.date_start || '',
        dateStop: insight.date_stop || '',
      };
    });
  }
}
