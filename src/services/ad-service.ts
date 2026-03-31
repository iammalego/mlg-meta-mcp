/**
 * Ad Service
 *
 * Business logic for ad operations.
 */

import { GraphClient } from '../api/graph-client.js';
import type { MetaAd } from '../types/index.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

export class AdService {
  private client: GraphClient;

  constructor(accessToken: string) {
    this.client = new GraphClient(accessToken);
  }

  /**
   * Get ads from an ad set or campaign
   *
   * @param parentId - Ad set ID or Campaign ID
   * @param status - Filter by status
   * @returns List of ads
   */
  async getAds(parentId: string, status: 'ACTIVE' | 'PAUSED' | 'ALL' = 'ALL'): Promise<MetaAd[]> {
    logger.info({ parentId, status }, 'Fetching ads');

    const ads = await this.client.getAds(parentId, status);

    logger.info({ count: ads.length, parentId }, 'Ads fetched');

    return ads;
  }

  /**
   * Create a new ad
   *
   * @param adSetId - Parent ad set ID
   * @param config - Ad configuration
   * @returns Created ad info
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
    logger.info({ adSetId, name: config.name }, 'Creating ad');

    const result = await this.client.createAd(adSetId, config);

    logger.info({ adId: result.id }, 'Ad created');

    return result;
  }
}
