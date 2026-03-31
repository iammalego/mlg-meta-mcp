/**
 * Account Service
 *
 * Manages ad account discovery and caching.
 *
 * Responsibilities:
 * - Discover accounts via Business API
 * - Cache results with TTL
 * - Resolve names to IDs
 */

import { BusinessClient } from '../api/business-client.js';
import { config } from '../config/index.js';
import { getLogger } from '../utils/logger.js';
import type { MetaAdAccount } from '../types/index.js';

const logger = getLogger();

interface CacheEntry {
  data: MetaAdAccount[];
  timestamp: number;
}

export class AccountService {
  private client: BusinessClient;
  private cache: CacheEntry | null = null;
  private cacheTTL: number;

  constructor(accessToken: string) {
    this.client = new BusinessClient(accessToken);
    this.cacheTTL = config.CACHE_TTL_SECONDS * 1000;
  }

  /**
   * Discover all ad accounts with caching
   *
   * If cache is valid (within TTL), returns cached data.
   * Otherwise, fetches from Meta API and updates cache.
   */
  async discoverAdAccounts(): Promise<MetaAdAccount[]> {
    const cached = this.getFromCache();
    if (cached) {
      logger.info({ count: cached.length }, 'Returning cached accounts');
      return cached;
    }

    logger.info('Discovering ad accounts from Meta API');
    const accounts = await this.client.discoverAdAccounts();

    this.setCache(accounts);

    logger.info({ count: accounts.length }, 'Discovered accounts');
    return accounts;
  }

  /**
   * Resolve an account identifier to an account ID
   *
   * Supports:
   * - Direct ID: "act_123456" -> "act_123456"
   * - Name: "Plannit" -> "act_123456" (requires cache)
   */
  async resolveAccount(accountIdOrName: string): Promise<string> {
    if (accountIdOrName.startsWith('act_')) {
      return accountIdOrName;
    }

    const accounts = await this.discoverAdAccounts();
    const match = accounts.find((acc) => acc.name.toLowerCase() === accountIdOrName.toLowerCase());

    if (!match) {
      throw new Error(
        `Account not found: "${accountIdOrName}". ` +
          `Available accounts: ${accounts.map((a) => a.name).join(', ')}`
      );
    }

    logger.info({ name: accountIdOrName, id: match.id }, 'Resolved account');
    return match.id;
  }

  /**
   * Get a specific account by ID or name
   */
  async getAccount(accountIdOrName: string): Promise<MetaAdAccount> {
    const id = await this.resolveAccount(accountIdOrName);
    const accounts = await this.discoverAdAccounts();
    const account = accounts.find((acc) => acc.id === id);

    if (!account) {
      throw new Error(`Account with ID ${id} not found`);
    }

    return account;
  }

  /**
   * Clear the cache (useful for testing or force refresh)
   */
  clearCache(): void {
    this.cache = null;
    logger.info('Account cache cleared');
  }

  private getFromCache(): MetaAdAccount[] | null {
    if (!this.cache) return null;

    const age = Date.now() - this.cache.timestamp;
    if (age > this.cacheTTL) {
      logger.debug({ ageMs: age, ttlMs: this.cacheTTL }, 'Cache expired');
      this.cache = null;
      return null;
    }

    return this.cache.data;
  }

  private setCache(data: MetaAdAccount[]): void {
    this.cache = {
      data,
      timestamp: Date.now(),
    };
    logger.debug({ count: data.length, ttlSeconds: config.CACHE_TTL_SECONDS }, 'Cache updated');
  }
}
