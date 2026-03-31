/**
 * AdSet Service
 *
 * Business logic for ad set operations.
 */

import { GraphClient } from '../api/graph-client.js';
import type { AccountService } from './account-service.js';
import type { MetaAdSet } from '../types/index.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

export class AdSetService {
  private client: GraphClient;
  private accountService: AccountService;

  constructor(accessToken: string, accountService: AccountService) {
    this.client = new GraphClient(accessToken);
    this.accountService = accountService;
  }

  /**
   * Get ad sets from a campaign or account
   *
   * @param campaignIdOrAccountId - Campaign ID or Account ID
   * @param status - Filter by status
   * @returns List of ad sets
   */
  async getAdSets(
    campaignIdOrAccountId: string,
    status: 'ACTIVE' | 'PAUSED' | 'ALL' = 'ALL'
  ): Promise<MetaAdSet[]> {
    // Resolve if it's an account name
    // Numeric strings are campaign IDs. act_ strings are account IDs.
    // Anything else is treated as an account name and must resolve — throw if not found.
    let parentId = campaignIdOrAccountId;
    if (!campaignIdOrAccountId.startsWith('act_') && !/^\d+$/.test(campaignIdOrAccountId)) {
      parentId = await this.accountService.resolveAccount(campaignIdOrAccountId);
    }

    logger.info({ parentId, status }, 'Fetching ad sets');

    const adsets = await this.client.getAdSets(parentId, status);

    logger.info({ count: adsets.length, parentId }, 'Ad sets fetched');

    return adsets;
  }

  /**
   * Get a single ad set by ID
   *
   * @param adSetId - Ad set ID
   * @returns Ad set details
   */
  async getAdSet(adSetId: string): Promise<MetaAdSet> {
    return this.client.getAdSet(adSetId);
  }

  /**
   * Create a new ad set
   *
   * @param campaignIdOrName - Campaign identifier
   * @param config - Ad set configuration
   * @returns Created ad set info
   */
  async createAdSet(
    campaignIdOrName: string,
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
    // Resolve campaign ID
    const campaignId = campaignIdOrName;
    if (!campaignIdOrName.startsWith('act_') && !/^\d+$/.test(campaignIdOrName)) {
      // Try to find campaign by name - this is complex, we'd need to list campaigns
      // For now, assume it's an ID or throw error
      throw new Error(
        `Campaign ID required (got "${campaignIdOrName}"). Use campaign ID directly.`
      );
    }

    logger.info({ campaignId, name: config.name }, 'Creating ad set');

    const result = await this.client.createAdSet(campaignId, config);

    logger.info({ adSetId: result.id }, 'Ad set created');

    return result;
  }

  /**
   * Update an existing ad set
   *
   * @param adSetId - Ad set ID
   * @param updates - Fields to update
   * @returns Updated ad set info
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
  ): Promise<{ id: string; name: string; previousStatus: string }> {
    const adset = await this.client.getAdSet(adSetId);
    const previousStatus = adset.status;

    logger.info({ adSetId, previousStatus }, 'Updating ad set');

    const result = await this.client.updateAdSet(adSetId, updates);

    logger.info({ adSetId }, 'Ad set updated');

    return {
      id: result.id,
      name: result.name,
      previousStatus,
    };
  }

  /**
   * Pause an ad set
   *
   * @param adSetId - Ad set ID
   * @returns Updated ad set info
   */
  async pauseAdSet(adSetId: string): Promise<{ id: string; name: string; previousStatus: string }> {
    const adset = await this.client.getAdSet(adSetId);
    const previousStatus = adset.status;

    logger.info({ adSetId, previousStatus }, 'Pausing ad set');

    const result = await this.client.updateAdSetStatus(adSetId, 'PAUSED');

    logger.info({ adSetId, newStatus: result.status }, 'Ad set paused');

    return {
      id: result.id,
      name: adset.name,
      previousStatus,
    };
  }

  /**
   * Activate an ad set
   *
   * @param adSetId - Ad set ID
   * @returns Updated ad set info
   */
  async activateAdSet(
    adSetId: string
  ): Promise<{ id: string; name: string; previousStatus: string }> {
    const adset = await this.client.getAdSet(adSetId);
    const previousStatus = adset.status;

    logger.info({ adSetId, previousStatus }, 'Activating ad set');

    const result = await this.client.updateAdSetStatus(adSetId, 'ACTIVE');

    logger.info({ adSetId, newStatus: result.status }, 'Ad set activated');

    return {
      id: result.id,
      name: adset.name,
      previousStatus,
    };
  }

  /**
   * Clone an ad set to a target campaign
   *
   * @param sourceAdSetId - Ad set to clone
   * @param targetCampaignId - Campaign to clone into
   * @param newName - Name for the cloned ad set
   * @returns Cloned ad set info
   */
  async cloneAdSet(
    sourceAdSetId: string,
    targetCampaignId: string,
    newName?: string
  ): Promise<{
    adSetId: string;
    adSetName: string;
  }> {
    // Get source ad set
    const sourceAdSet = await this.client.getAdSet(sourceAdSetId);

    const clonedName = newName || `${sourceAdSet.name} (Copy)`;

    logger.info({ sourceAdSetId, targetCampaignId, newName: clonedName }, 'Cloning ad set');

    const clonedAdSet = await this.client.createAdSet(targetCampaignId, {
      name: clonedName,
      dailyBudget: sourceAdSet.dailyBudget,
      lifetimeBudget: sourceAdSet.lifetimeBudget,
      targeting: sourceAdSet.targeting,
      bidStrategy: sourceAdSet.bidStrategy,
      billingEvent: sourceAdSet.billingEvent,
      optimizationGoal: sourceAdSet.optimizationGoal,
      status: 'PAUSED',
    });

    logger.info({ clonedAdSetId: clonedAdSet.id }, 'Ad set cloned successfully');

    return {
      adSetId: clonedAdSet.id,
      adSetName: clonedAdSet.name,
    };
  }
}
