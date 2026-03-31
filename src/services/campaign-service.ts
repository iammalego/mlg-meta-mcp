/**
 * Campaign Service
 *
 * Business logic for campaign operations.
 * Orchestrates between AccountService (account resolution) and GraphClient (API calls).
 */

import { GraphClient } from '../api/graph-client.js';
import type { AccountService } from './account-service.js';
import type { MetaCampaign } from '../types/index.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

export class CampaignService {
  private client: GraphClient;
  private accountService: AccountService;

  constructor(accessToken: string, accountService: AccountService) {
    this.client = new GraphClient(accessToken);
    this.accountService = accountService;
  }

  /**
   * Get campaigns from an account
   *
   * @param accountIdOrName - Account ID (act_XXX) or name (e.g., "Plannit")
   * @param status - Filter by status
   * @returns List of campaigns
   */
  async getCampaigns(
    accountIdOrName: string,
    status: 'ACTIVE' | 'PAUSED' | 'ALL' = 'ALL'
  ): Promise<MetaCampaign[]> {
    const accountId = await this.accountService.resolveAccount(accountIdOrName);

    logger.info({ accountId, status }, 'Fetching campaigns');

    const campaigns = await this.client.getCampaigns(accountId, status);

    logger.info({ count: campaigns.length, accountId }, 'Campaigns fetched');

    return campaigns;
  }

  /**
   * Create a new campaign
   *
   * @param accountIdOrName - Account identifier
   * @param config - Campaign configuration
   * @returns Created campaign info
   */
  async createCampaign(
    accountIdOrName: string,
    config: {
      name: string;
      objective: string;
      status: 'ACTIVE' | 'PAUSED';
      dailyBudget?: number;
      lifetimeBudget?: number;
    }
  ): Promise<{ id: string; name: string }> {
    const accountId = await this.accountService.resolveAccount(accountIdOrName);

    logger.info({ accountId, name: config.name }, 'Creating campaign');

    const result = await this.client.createCampaign(accountId, config);

    logger.info({ campaignId: result.id }, 'Campaign created');

    return result;
  }

  /**
   * Update an existing campaign
   *
   * @param campaignId - Campaign ID
   * @param updates - Fields to update
   * @returns Updated campaign info
   */
  async updateCampaign(
    campaignId: string,
    updates: {
      name?: string;
      status?: 'ACTIVE' | 'PAUSED';
      dailyBudget?: number;
      lifetimeBudget?: number;
    }
  ): Promise<{ id: string; name: string; previousStatus: string }> {
    const campaign = await this.client.getCampaign(campaignId);
    const previousStatus = campaign.status;

    logger.info({ campaignId, previousStatus }, 'Updating campaign');

    const result = await this.client.updateCampaign(campaignId, updates);

    logger.info({ campaignId }, 'Campaign updated');

    return {
      id: result.id,
      name: result.name,
      previousStatus,
    };
  }

  /**
   * Pause a campaign
   *
   * @param campaignId - Campaign ID
   * @returns Updated campaign info
   */
  async pauseCampaign(
    campaignId: string
  ): Promise<{ id: string; name: string; previousStatus: string }> {
    const campaign = await this.client.getCampaign(campaignId);
    const previousStatus = campaign.status;

    logger.info({ campaignId, previousStatus }, 'Pausing campaign');

    const result = await this.client.updateCampaignStatus(campaignId, 'PAUSED');

    logger.info({ campaignId, newStatus: result.status }, 'Campaign paused');

    return {
      id: result.id,
      name: campaign.name,
      previousStatus,
    };
  }

  /**
   * Activate (resume) a campaign
   *
   * @param campaignId - Campaign ID
   * @returns Updated campaign info
   */
  async activateCampaign(
    campaignId: string
  ): Promise<{ id: string; name: string; previousStatus: string }> {
    const campaign = await this.client.getCampaign(campaignId);
    const previousStatus = campaign.status;

    logger.info({ campaignId, previousStatus }, 'Activating campaign');

    const result = await this.client.updateCampaignStatus(campaignId, 'ACTIVE');

    logger.info({ campaignId, newStatus: result.status }, 'Campaign activated');

    return {
      id: result.id,
      name: campaign.name,
      previousStatus,
    };
  }

  /**
   * Get a single campaign by ID
   *
   * @param campaignId - Campaign ID
   * @returns Campaign details
   */
  async getCampaign(campaignId: string): Promise<MetaCampaign> {
    return this.client.getCampaign(campaignId);
  }

  /**
   * Clone a campaign with all its structure
   *
   * @param sourceCampaignId - Campaign to clone
   * @param newName - Name for the new campaign
   * @param copyAdSets - Whether to clone adsets
   * @param copyAds - Whether to clone ads within adsets
   * @param budgetAdjustment - Percentage to adjust budget
   * @returns New campaign ID and cloning summary
   */
  async cloneCampaign(
    sourceCampaignId: string,
    newName: string,
    copyAdSets: boolean = true,
    copyAds: boolean = false,
    budgetAdjustment: number = 0
  ): Promise<{
    newCampaignId: string;
    adSetsCloned: number;
    adsCloned: number;
  }> {
    // Get source campaign details
    const sourceCampaign = await this.client.getCampaign(sourceCampaignId);

    // Get account ID from source campaign
    const accountId = sourceCampaign.accountId;
    if (!accountId) {
      throw new Error('Could not determine account ID from source campaign');
    }

    logger.info(
      {
        sourceCampaignId,
        newName,
        copyAdSets,
        copyAds,
        budgetAdjustment,
        accountId,
      },
      'Cloning campaign'
    );

    // Calculate adjusted budget
    let adjustedDailyBudget = sourceCampaign.dailyBudget;
    let adjustedLifetimeBudget = sourceCampaign.lifetimeBudget;

    if (budgetAdjustment !== 0 && sourceCampaign.dailyBudget) {
      adjustedDailyBudget = Math.round(sourceCampaign.dailyBudget * (1 + budgetAdjustment / 100));
    }

    if (budgetAdjustment !== 0 && sourceCampaign.lifetimeBudget) {
      adjustedLifetimeBudget = Math.round(
        sourceCampaign.lifetimeBudget * (1 + budgetAdjustment / 100)
      );
    }

    // Create new campaign
    const newCampaign = await this.client.createCampaign(accountId, {
      name: newName,
      objective: sourceCampaign.objective,
      status: 'PAUSED', // Always start as paused
      dailyBudget: adjustedDailyBudget,
      lifetimeBudget: adjustedLifetimeBudget,
    });

    let adSetsCloned = 0;
    let adsCloned = 0;

    if (copyAdSets) {
      // Get adsets from source campaign
      const sourceAdSets = await this.client.getAdSets(sourceCampaignId, 'ALL');

      for (const adSet of sourceAdSets) {
        // Clone adset to new campaign
        const clonedAdSet = await this.client.createAdSet(newCampaign.id, {
          name: adSet.name,
          dailyBudget:
            budgetAdjustment !== 0 && adSet.dailyBudget
              ? Math.round(adSet.dailyBudget * (1 + budgetAdjustment / 100))
              : adSet.dailyBudget,
          lifetimeBudget:
            budgetAdjustment !== 0 && adSet.lifetimeBudget
              ? Math.round(adSet.lifetimeBudget * (1 + budgetAdjustment / 100))
              : adSet.lifetimeBudget,
          targeting: adSet.targeting,
          bidStrategy: adSet.bidStrategy,
          billingEvent: adSet.billingEvent,
          optimizationGoal: adSet.optimizationGoal,
          status: 'PAUSED',
        });

        adSetsCloned++;

        if (copyAds) {
          // Get ads from source adset
          const sourceAds = await this.client.getAds(adSet.id, 'ALL');

          for (const ad of sourceAds) {
            if (ad.creative) {
              await this.client.createAd(clonedAdSet.id, {
                name: ad.name,
                creative: ad.creative,
                status: 'PAUSED',
              });
              adsCloned++;
            }
          }
        }
      }
    }

    logger.info(
      {
        newCampaignId: newCampaign.id,
        adSetsCloned,
        adsCloned,
      },
      'Campaign cloned successfully'
    );

    return {
      newCampaignId: newCampaign.id,
      adSetsCloned,
      adsCloned,
    };
  }

  /**
   * Pause multiple campaigns in bulk
   *
   * @param campaignIds - Array of campaign IDs
   * @param dryRun - If true, only preview changes
   * @returns Summary of operations
   */
  async bulkPauseCampaigns(
    campaignIds: string[],
    dryRun: boolean = false
  ): Promise<{
    processed: number;
    paused: number;
    alreadyPaused: number;
    errors: number;
    details: Array<{ id: string; name: string; status: string; action: string }>;
  }> {
    logger.info({ count: campaignIds.length, dryRun }, 'Bulk pausing campaigns');

    const details: Array<{ id: string; name: string; status: string; action: string }> = [];
    let paused = 0;
    let alreadyPaused = 0;
    let errors = 0;

    for (const campaignId of campaignIds) {
      try {
        const campaign = await this.client.getCampaign(campaignId);

        if (campaign.status === 'PAUSED') {
          alreadyPaused++;
          details.push({
            id: campaignId,
            name: campaign.name,
            status: campaign.status,
            action: 'skipped_already_paused',
          });
        } else {
          if (!dryRun) {
            await this.client.updateCampaignStatus(campaignId, 'PAUSED');
          }
          paused++;
          details.push({
            id: campaignId,
            name: campaign.name,
            status: campaign.status,
            action: dryRun ? 'would_pause' : 'paused',
          });
        }
      } catch (error) {
        errors++;
        details.push({
          id: campaignId,
          name: 'Unknown',
          status: 'ERROR',
          action: `error: ${(error as Error).message}`,
        });
      }
    }

    logger.info({ paused, alreadyPaused, errors, dryRun }, 'Bulk pause completed');

    return {
      processed: campaignIds.length,
      paused,
      alreadyPaused,
      errors,
      details,
    };
  }

  /**
   * Activate multiple campaigns in bulk
   *
   * @param campaignIds - Array of campaign IDs
   * @param dryRun - If true, only preview changes
   * @returns Summary of operations
   */
  async bulkActivateCampaigns(
    campaignIds: string[],
    dryRun: boolean = false
  ): Promise<{
    processed: number;
    activated: number;
    alreadyActive: number;
    errors: number;
    details: Array<{ id: string; name: string; status: string; action: string }>;
  }> {
    logger.info({ count: campaignIds.length, dryRun }, 'Bulk activating campaigns');

    const details: Array<{ id: string; name: string; status: string; action: string }> = [];
    let activated = 0;
    let alreadyActive = 0;
    let errors = 0;

    for (const campaignId of campaignIds) {
      try {
        const campaign = await this.client.getCampaign(campaignId);

        if (campaign.status === 'ACTIVE') {
          alreadyActive++;
          details.push({
            id: campaignId,
            name: campaign.name,
            status: campaign.status,
            action: 'skipped_already_active',
          });
        } else {
          if (!dryRun) {
            await this.client.updateCampaignStatus(campaignId, 'ACTIVE');
          }
          activated++;
          details.push({
            id: campaignId,
            name: campaign.name,
            status: campaign.status,
            action: dryRun ? 'would_activate' : 'activated',
          });
        }
      } catch (error) {
        errors++;
        details.push({
          id: campaignId,
          name: 'Unknown',
          status: 'ERROR',
          action: `error: ${(error as Error).message}`,
        });
      }
    }

    logger.info({ activated, alreadyActive, errors, dryRun }, 'Bulk activate completed');

    return {
      processed: campaignIds.length,
      activated,
      alreadyActive,
      errors,
      details,
    };
  }

  /**
   * Check campaigns for performance alerts
   *
   * @param accountId - Account to check
   * @param cprThreshold - CPR threshold in cents
   * @param minCtr - Minimum CTR percentage
   * @param minDailySpend - Minimum daily spend in cents
   * @param datePreset - Time period to analyze
   * @returns Alert summary
   */
  async checkAlerts(
    accountId: string,
    cprThreshold: number = 5000,
    minCtr: number = 1.0,
    minDailySpend: number = 1000,
    datePreset: string = 'yesterday'
  ): Promise<{
    campaignsChecked: number;
    alerts: Array<{
      campaignId: string;
      campaignName: string;
      alertType: 'high_cpr' | 'low_ctr' | 'low_spend';
      value: number;
      threshold: number;
      message: string;
    }>;
    summary: string;
  }> {
    logger.info({ accountId, cprThreshold, minCtr, datePreset }, 'Checking alerts');

    // Resolve account
    const resolvedAccountId = await this.accountService.resolveAccount(accountId);

    // Get campaigns
    const campaigns = await this.client.getCampaigns(resolvedAccountId, 'ACTIVE');

    const alerts: Array<{
      campaignId: string;
      campaignName: string;
      alertType: 'high_cpr' | 'low_ctr' | 'low_spend';
      value: number;
      threshold: number;
      message: string;
    }> = [];

    for (const campaign of campaigns) {
      try {
        // Get insights for this campaign
        const insights = await this.client.getCampaignInsights(campaign.id, datePreset);

        if (insights) {
          // Check high CPR
          if (insights.cpr > cprThreshold) {
            alerts.push({
              campaignId: campaign.id,
              campaignName: campaign.name,
              alertType: 'high_cpr',
              value: insights.cpr,
              threshold: cprThreshold,
              message: `CPR $${(insights.cpr / 100).toFixed(2)} exceeds threshold $${(cprThreshold / 100).toFixed(2)}`,
            });
          }

          // Check low CTR
          if (insights.ctr < minCtr) {
            alerts.push({
              campaignId: campaign.id,
              campaignName: campaign.name,
              alertType: 'low_ctr',
              value: insights.ctr,
              threshold: minCtr,
              message: `CTR ${insights.ctr.toFixed(2)}% below minimum ${minCtr}%`,
            });
          }

          // Check low spend
          if (insights.spend < minDailySpend) {
            alerts.push({
              campaignId: campaign.id,
              campaignName: campaign.name,
              alertType: 'low_spend',
              value: insights.spend,
              threshold: minDailySpend,
              message: `Spend $${(insights.spend / 100).toFixed(2)} below minimum $${(minDailySpend / 100).toFixed(2)}`,
            });
          }
        }
      } catch (error) {
        logger.warn({ campaignId: campaign.id, error }, 'Failed to get insights for alert check');
      }
    }

    const summary =
      alerts.length === 0
        ? 'No alerts found. All campaigns performing within thresholds.'
        : `Found ${alerts.length} alerts across ${campaigns.length} campaigns.`;

    logger.info(
      { campaignsChecked: campaigns.length, alertCount: alerts.length },
      'Alert check completed'
    );

    return {
      campaignsChecked: campaigns.length,
      alerts,
      summary,
    };
  }
}
