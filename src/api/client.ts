/**
 * Meta API Client
 *
 * Base client for Meta Marketing API with:
 * - Multi-endpoint support (Graph API, Insights API)
 * - Rate limiting with exponential backoff
 * - Authentication handling
 * - Error categorization
 */

export { TargetingClient } from './targeting-client.js';
export { CreativeClient } from './creative-client.js';

export class MetaApiClient {
  constructor(accessToken: string, apiVersion: string = 'v22.0') {
    void accessToken;
    void apiVersion;
  }

  /**
   * Make a GET request to the Meta API
   */
  async get<T>(_endpoint: string, _params: Record<string, string> = {}): Promise<T> {
    // TODO: Build URL with version
    // TODO: Add access token
    // TODO: Add params
    // TODO: Execute fetch
    // TODO: Handle errors (401, 403, 429, etc.)
    // TODO: Implement retry with backoff

    throw new Error('Not implemented');
  }

  /**
   * Make a POST request to the Meta API
   */
  async post<T>(_endpoint: string, _data: Record<string, unknown>): Promise<T> {
    // TODO: Similar to get but with POST
    throw new Error('Not implemented');
  }
}

/**
 * Specialized client for Graph API (CRUD operations)
 */
export class GraphApiClient extends MetaApiClient {
  // TODO: Campaign operations
  // TODO: AdSet operations
  // TODO: Ad operations
}

/**
 * Specialized client for Insights API (metrics)
 */
export class InsightsApiClient extends MetaApiClient {
  // TODO: Insights operations
  // TODO: Breakdowns support
  // TODO: Period comparisons
}
