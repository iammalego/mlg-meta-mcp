/**
 * Graph API Client
 *
 * CRUD operations for campaigns, adsets, and ads.
 * Uses the /{parent-id}/{object-type} endpoint from Meta.
 */

import { MetaApiClient } from './base-client.js';
import type { MetaCampaign, MetaAdSet, MetaAd } from '../types/index.js';

// Meta API response types
interface CampaignsResponse {
  data: Array<{
    id: string;
    name: string;
    status: string;
    effective_status: string;
    objective: string;
    daily_budget?: string;
    lifetime_budget?: string;
    budget_remaining?: string;
    created_time: string;
  }>;
  paging?: {
    cursors?: {
      after?: string;
    };
    next?: string;
  };
}

interface CampaignResponse {
  id: string;
  name: string;
  status: string;
  objective: string;
  [key: string]: unknown;
}

interface AdSetsResponse {
  data: Array<{
    id: string;
    name: string;
    campaign_id: string;
    status: string;
    effective_status: string;
    daily_budget?: string;
    lifetime_budget?: string;
    targeting?: Record<string, unknown>;
    bid_strategy?: string;
    billing_event?: string;
    optimization_goal?: string;
    start_time?: string;
    end_time?: string;
  }>;
  paging?: {
    cursors?: {
      after?: string;
    };
    next?: string;
  };
}

interface AdSetResponse {
  id: string;
  name: string;
  status: string;
  [key: string]: unknown;
}

interface AdsResponse {
  data: Array<{
    id: string;
    name: string;
    adset_id: string;
    campaign_id: string;
    status: string;
    effective_status: string;
    creative?: {
      object_story_spec?: {
        page_id?: string;
        link_data?: {
          message?: string;
          name?: string;
          link?: string;
          call_to_action?: { type: string };
          picture?: string;
        };
      };
    };
  }>;
  paging?: {
    cursors?: {
      after?: string;
    };
    next?: string;
  };
}

interface AdResponse {
  id: string;
  name: string;
  status: string;
  [key: string]: unknown;
}

export class GraphClient extends MetaApiClient {
  // ==================== CAMPAIGN OPERATIONS ====================

  /**
   * Get campaigns for an ad account
   *
   * Endpoint: GET /{account-id}/campaigns
   */
  async getCampaigns(
    accountId: string,
    status: 'ACTIVE' | 'PAUSED' | 'ALL' = 'ALL'
  ): Promise<MetaCampaign[]> {
    const fields = [
      'id',
      'name',
      'status',
      'effective_status',
      'objective',
      'daily_budget',
      'lifetime_budget',
      'budget_remaining',
      'created_time',
    ].join(',');

    const params: Record<string, string | object> = {
      fields,
      limit: '100',
    };

    if (status !== 'ALL') {
      params.effective_status = JSON.stringify([status]);
    }

    const response = await this.get<CampaignsResponse>(`${accountId}/campaigns`, params);

    return response.data.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.effective_status || campaign.status,
      objective: campaign.objective,
      dailyBudget: campaign.daily_budget ? parseInt(campaign.daily_budget, 10) : undefined,
      lifetimeBudget: campaign.lifetime_budget ? parseInt(campaign.lifetime_budget, 10) : undefined,
      createdTime: campaign.created_time,
    }));
  }

  /**
   * Get a single campaign by ID
   *
   * Endpoint: GET /{campaign-id}
   */
  async getCampaign(campaignId: string): Promise<MetaCampaign & { accountId?: string }> {
    const fields = [
      'id',
      'name',
      'status',
      'effective_status',
      'objective',
      'daily_budget',
      'lifetime_budget',
      'budget_remaining',
      'created_time',
      'account_id', // Include account ID for cloning
    ].join(',');

    const response = await this.get<CampaignResponse>(campaignId, { fields });

    return {
      id: response.id,
      name: response.name,
      status:
        (response as CampaignResponse & { effective_status?: string }).effective_status ||
        response.status,
      objective: response.objective,
      dailyBudget: (response as CampaignResponse & { daily_budget?: string }).daily_budget
        ? parseInt((response as CampaignResponse & { daily_budget?: string }).daily_budget!, 10)
        : undefined,
      lifetimeBudget: (response as CampaignResponse & { lifetime_budget?: string }).lifetime_budget
        ? parseInt(
            (response as CampaignResponse & { lifetime_budget?: string }).lifetime_budget!,
            10
          )
        : undefined,
      createdTime: (response as CampaignResponse & { created_time?: string }).created_time || '',
      accountId: (response as CampaignResponse & { account_id?: string }).account_id,
    };
  }

  /**
   * Create a new campaign
   *
   * Endpoint: POST /{account-id}/campaigns
   */
  async createCampaign(
    accountId: string,
    config: {
      name: string;
      objective: string;
      status: 'ACTIVE' | 'PAUSED';
      dailyBudget?: number;
      lifetimeBudget?: number;
    }
  ): Promise<{ id: string; name: string }> {
    const body: Record<string, unknown> = {
      name: config.name,
      objective: config.objective,
      status: config.status,
    };

    if (config.dailyBudget) {
      body.daily_budget = config.dailyBudget;
    }

    if (config.lifetimeBudget) {
      body.lifetime_budget = config.lifetimeBudget;
    }

    const response = await this.post<CampaignResponse>(`${accountId}/campaigns`, body);

    return {
      id: response.id,
      name: response.name,
    };
  }

  /**
   * Update an existing campaign
   *
   * Endpoint: POST /{campaign-id}
   */
  async updateCampaign(
    campaignId: string,
    updates: {
      name?: string;
      status?: 'ACTIVE' | 'PAUSED';
      dailyBudget?: number;
      lifetimeBudget?: number;
    }
  ): Promise<{ id: string; name: string }> {
    const body: Record<string, unknown> = {};

    if (updates.name) body.name = updates.name;
    if (updates.status) body.status = updates.status;
    if (updates.dailyBudget) body.daily_budget = updates.dailyBudget;
    if (updates.lifetimeBudget) body.lifetime_budget = updates.lifetimeBudget;

    const response = await this.post<CampaignResponse>(campaignId, body);

    return {
      id: response.id,
      name: response.name,
    };
  }

  /**
   * Update a campaign status
   *
   * Endpoint: POST /{campaign-id}
   */
  async updateCampaignStatus(
    campaignId: string,
    status: 'ACTIVE' | 'PAUSED'
  ): Promise<{ id: string; status: string }> {
    const response = await this.post<CampaignResponse>(campaignId, {
      status,
    });

    return {
      id: response.id,
      status: response.status,
    };
  }

  /**
   * Delete a campaign
   *
   * Endpoint: DELETE /{campaign-id}
   */
  async deleteCampaign(campaignId: string): Promise<{ success: boolean }> {
    await this.updateCampaignStatus(campaignId, 'PAUSED');
    return { success: true };
  }

  // ==================== ADSET OPERATIONS ====================

  /**
   * Get ad sets from a campaign or account
   *
   * Endpoint: GET /{campaign-id}/adsets or /{account-id}/adsets
   */
  async getAdSets(
    parentId: string,
    status: 'ACTIVE' | 'PAUSED' | 'ALL' = 'ALL'
  ): Promise<MetaAdSet[]> {
    const fields = [
      'id',
      'name',
      'campaign_id',
      'status',
      'effective_status',
      'daily_budget',
      'lifetime_budget',
      'targeting',
      'bid_strategy',
      'billing_event',
      'optimization_goal',
      'start_time',
      'end_time',
    ].join(',');

    const params: Record<string, string | object> = {
      fields,
      limit: '100',
    };

    if (status !== 'ALL') {
      params.effective_status = JSON.stringify([status]);
    }

    const response = await this.get<AdSetsResponse>(`${parentId}/adsets`, params);

    return response.data.map((adset) => ({
      id: adset.id,
      name: adset.name,
      campaignId: adset.campaign_id,
      status: adset.effective_status || adset.status,
      dailyBudget: adset.daily_budget ? parseInt(adset.daily_budget, 10) : undefined,
      lifetimeBudget: adset.lifetime_budget ? parseInt(adset.lifetime_budget, 10) : undefined,
      targeting: adset.targeting,
      bidStrategy: adset.bid_strategy,
      billingEvent: adset.billing_event,
      optimizationGoal: adset.optimization_goal,
      startTime: adset.start_time,
      endTime: adset.end_time,
    }));
  }

  /**
   * Get a single ad set by ID
   *
   * Endpoint: GET /{adset-id}
   */
  async getAdSet(adSetId: string): Promise<MetaAdSet> {
    const fields = [
      'id',
      'name',
      'campaign_id',
      'status',
      'effective_status',
      'daily_budget',
      'lifetime_budget',
      'targeting',
      'bid_strategy',
      'billing_event',
      'optimization_goal',
    ].join(',');

    const response = await this.get<AdSetResponse>(adSetId, { fields });
    const data = response as unknown as AdSetsResponse['data'][0];

    return {
      id: data.id,
      name: data.name,
      campaignId: data.campaign_id,
      status: data.effective_status || data.status,
      dailyBudget: data.daily_budget ? parseInt(data.daily_budget, 10) : undefined,
      lifetimeBudget: data.lifetime_budget ? parseInt(data.lifetime_budget, 10) : undefined,
      targeting: data.targeting,
      bidStrategy: data.bid_strategy,
      billingEvent: data.billing_event,
      optimizationGoal: data.optimization_goal,
    };
  }

  /**
   * Create a new ad set
   *
   * Endpoint: POST /{campaign-id}/adsets
   */
  async createAdSet(
    campaignId: string,
    config: {
      name: string;
      dailyBudget?: number;
      lifetimeBudget?: number;
      targeting?: Record<string, unknown>;
      bidStrategy?: string;
      billingEvent?: string;
      optimizationGoal?: string;
      status?: 'ACTIVE' | 'PAUSED';
    }
  ): Promise<{ id: string; name: string }> {
    const body: Record<string, unknown> = {
      name: config.name,
      status: config.status || 'PAUSED',
    };

    if (config.dailyBudget) body.daily_budget = config.dailyBudget;
    if (config.lifetimeBudget) body.lifetime_budget = config.lifetimeBudget;
    if (config.targeting) body.targeting = config.targeting;
    if (config.bidStrategy) body.bid_strategy = config.bidStrategy;
    if (config.billingEvent) body.billing_event = config.billingEvent;
    if (config.optimizationGoal) body.optimization_goal = config.optimizationGoal;

    const response = await this.post<AdSetResponse>(`${campaignId}/adsets`, body);

    return {
      id: response.id,
      name: response.name,
    };
  }

  /**
   * Update an existing ad set
   *
   * Endpoint: POST /{adset-id}
   */
  async updateAdSet(
    adSetId: string,
    updates: {
      name?: string;
      status?: 'ACTIVE' | 'PAUSED';
      dailyBudget?: number;
      lifetimeBudget?: number;
      targeting?: Record<string, unknown>;
    }
  ): Promise<{ id: string; name: string }> {
    const body: Record<string, unknown> = {};

    if (updates.name) body.name = updates.name;
    if (updates.status) body.status = updates.status;
    if (updates.dailyBudget) body.daily_budget = updates.dailyBudget;
    if (updates.lifetimeBudget) body.lifetime_budget = updates.lifetimeBudget;
    if (updates.targeting) body.targeting = updates.targeting;

    const response = await this.post<AdSetResponse>(adSetId, body);

    return {
      id: response.id,
      name: response.name,
    };
  }

  /**
   * Update ad set status
   *
   * Endpoint: POST /{adset-id}
   */
  async updateAdSetStatus(
    adSetId: string,
    status: 'ACTIVE' | 'PAUSED'
  ): Promise<{ id: string; status: string }> {
    const response = await this.post<AdSetResponse>(adSetId, { status });

    return {
      id: response.id,
      status: response.status,
    };
  }

  // ==================== AD OPERATIONS ====================

  /**
   * Get ads from an ad set or campaign
   *
   * Endpoint: GET /{adset-id}/ads or /{campaign-id}/ads
   */
  async getAds(parentId: string, status: 'ACTIVE' | 'PAUSED' | 'ALL' = 'ALL'): Promise<MetaAd[]> {
    const fields = [
      'id',
      'name',
      'adset_id',
      'campaign_id',
      'status',
      'effective_status',
      'creative',
    ].join(',');

    const params: Record<string, string | object> = {
      fields,
      limit: '100',
    };

    if (status !== 'ALL') {
      params.effective_status = JSON.stringify([status]);
    }

    const response = await this.get<AdsResponse>(`${parentId}/ads`, params);

    return response.data.map((ad) => {
      const creative = ad.creative?.object_story_spec?.link_data;

      return {
        id: ad.id,
        name: ad.name,
        adSetId: ad.adset_id,
        campaignId: ad.campaign_id,
        status: ad.effective_status || ad.status,
        creative: creative
          ? {
              title: creative.name,
              body: creative.message,
              linkUrl: creative.link,
              callToAction: creative.call_to_action?.type,
            }
          : undefined,
      };
    });
  }

  /**
   * Create a new ad
   *
   * Endpoint: POST /{adset-id}/ads
   */
  async createAd(
    adSetId: string,
    config: {
      name: string;
      creative: {
        title?: string;
        body?: string;
        imageUrl?: string;
        linkUrl?: string;
        callToAction?: string;
      };
      status?: 'ACTIVE' | 'PAUSED';
    }
  ): Promise<{ id: string; name: string }> {
    // Build creative object
    const creative: Record<string, unknown> = {
      object_story_spec: {
        page_id: '', // Required but often set at ad account level
        link_data: {
          name: config.creative.title,
          message: config.creative.body,
          link: config.creative.linkUrl,
        },
      },
    };

    if (config.creative.callToAction) {
      (creative.object_story_spec as Record<string, unknown>).link_data = {
        ...((creative.object_story_spec as Record<string, unknown>).link_data as object),
        call_to_action: {
          type: config.creative.callToAction,
        },
      };
    }

    const body: Record<string, unknown> = {
      name: config.name,
      adset_id: adSetId,
      status: config.status || 'PAUSED',
      creative,
    };

    const response = await this.post<AdResponse>(`${adSetId}/ads`, body);

    return {
      id: response.id,
      name: response.name,
    };
  }

  /**
   * Get campaign insights for alert checking
   *
   * Endpoint: GET /{campaign-id}/insights
   */
  async getCampaignInsights(
    campaignId: string,
    datePreset: string = 'yesterday'
  ): Promise<{ spend: number; cpr: number; ctr: number; results: number } | null> {
    const fields = ['spend', 'ctr', 'actions', 'cost_per_action_type'].join(',');

    const params: Record<string, string | object> = {
      fields,
      date_preset: datePreset,
      level: 'campaign',
    };

    try {
      const response = await this.get<{
        data: Array<{
          spend?: string;
          ctr?: string;
          actions?: Array<{ action_type: string; value: string }>;
          cost_per_action_type?: Array<{ action_type: string; value: string }>;
        }>;
      }>(`${campaignId}/insights`, params);

      if (!response.data || response.data.length === 0) {
        return null;
      }

      const insight = response.data[0];
      const spend = insight.spend ? parseFloat(insight.spend) : 0;
      const ctr = insight.ctr ? parseFloat(insight.ctr) : 0;

      // Calculate results from actions
      let results = 0;
      if (insight.actions) {
        results = insight.actions.reduce((sum, action) => {
          return sum + parseInt(action.value, 10);
        }, 0);
      }

      // Calculate CPR
      let cpr = 0;
      if (results > 0) {
        cpr = spend / results;
      } else if (insight.cost_per_action_type && insight.cost_per_action_type.length > 0) {
        // Use first available cost per action
        cpr = parseFloat(insight.cost_per_action_type[0].value);
      }

      return {
        spend,
        cpr,
        ctr,
        results,
      };
    } catch {
      return null;
    }
  }
}
