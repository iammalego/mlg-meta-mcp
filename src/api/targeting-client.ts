import { MetaTargetingItem } from '../types/index.js';
import { MetaApiClient } from './base-client.js';

interface SearchResponse {
  data?: Array<{
    id?: string;
    key?: string; // geo results use `key` instead of `id`
    name: string;
    audience_size?: number;
    path?: string[];
  }>;
}

export class TargetingClient extends MetaApiClient {
  /**
   * Core search method — calls GET /search and maps response.data to MetaTargetingItem.
   * Returns [] if the response has no data rather than throwing.
   */
  private async search(params: Record<string, string | number>): Promise<MetaTargetingItem[]> {
    const response = await this.get<SearchResponse>('search', params);

    if (!response.data || response.data.length === 0) {
      return [];
    }

    return response.data.map((item) => ({
      id: item.key ?? item.id ?? '',
      name: item.name,
      ...(item.audience_size !== undefined && { audienceSize: item.audience_size }),
      ...(item.path !== undefined && { path: item.path }),
    }));
  }

  async searchInterests(query: string, limit = 25): Promise<MetaTargetingItem[]> {
    return this.search({ type: 'adinterest', q: query, limit });
  }

  async getInterestSuggestions(
    interestList: string[],
    limit = 25
  ): Promise<MetaTargetingItem[]> {
    return this.search({
      type: 'adinterestsuggestion',
      interest_list: JSON.stringify(interestList),
      limit,
    });
  }

  async validateInterests(
    interestList?: string[],
    interestFbidList?: string[]
  ): Promise<MetaTargetingItem[]> {
    if (!interestList?.length && !interestFbidList?.length) {
      throw new Error('At least one of interestList or interestFbidList must be provided');
    }

    const params: Record<string, string | number> = { type: 'adinterestvalid' };

    if (interestList?.length) {
      params.interest_list = JSON.stringify(interestList);
    }

    if (interestFbidList?.length) {
      params.interest_fbid_list = JSON.stringify(interestFbidList);
    }

    return this.search(params);
  }

  async searchBehaviors(limit = 50): Promise<MetaTargetingItem[]> {
    return this.search({ type: 'adTargetingCategory', class: 'behaviors', limit });
  }

  async searchDemographics(demographicClass: string, limit = 50): Promise<MetaTargetingItem[]> {
    return this.search({ type: 'adTargetingCategory', class: demographicClass, limit });
  }

  async searchGeoLocations(
    query: string,
    locationTypes?: string[],
    limit = 25
  ): Promise<MetaTargetingItem[]> {
    const params: Record<string, string | number> = {
      type: 'adgeolocation',
      q: query,
      limit,
    };

    if (locationTypes?.length) {
      params.location_types = JSON.stringify(locationTypes);
    }

    return this.search(params);
  }
}
