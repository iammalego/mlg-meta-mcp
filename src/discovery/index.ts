/**
 * Account Discovery Module
 *
 * This module handles the automatic discovery of ad accounts
 * accessible via the System User Token.
 */

import type { MetaAdAccount } from '../types/index.js';

// TODO: Implement cache with TTL
const accountCache = new Map<string, MetaAdAccount>();

/**
 * Discover all ad accounts accessible to the System User Token
 */
export async function discoverAdAccounts(): Promise<MetaAdAccount[]> {
  // TODO: Check cache first
  // TODO: Call Meta Business API
  // TODO: Parse and normalize response
  // TODO: Update cache

  return [];
}

/**
 * Resolve account identifier (ID or name) to account ID
 */
export async function resolveAccount(accountIdOrName: string): Promise<string> {
  // TODO: Check if it's already an ID (starts with 'act_')
  // TODO: If not, search in discovered accounts by name
  // TODO: Return the resolved ID

  return accountIdOrName;
}

/**
 * Clear the account cache (useful for testing or force refresh)
 */
export function clearAccountCache(): void {
  accountCache.clear();
}
