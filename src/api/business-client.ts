/**
 * Meta Business API Client
 *
 * Usa el endpoint /me/adaccounts para descubrir cuentas publicitarias
 * accesibles por el System User Token.
 */

import { MetaApiClient } from './base-client.js';
import type { MetaAdAccount } from '../types/index.js';

interface MetaApiAccount {
  id: string;
  name: string;
  account_status: number;
  business?: {
    name: string;
  };
}

interface AdAccountsResponse {
  data: MetaApiAccount[];
  paging?: {
    cursors?: {
      after?: string;
    };
    next?: string;
  };
}

export class BusinessClient extends MetaApiClient {
  /**
   * Discover all ad accounts accessible to the token
   *
   * Meta endpoint: GET /me/adaccounts
   *
   * Returns accounts with format:
   * - id: "act_XXXXXX"
   * - name: Account name
   * - business_name: Name of the Business Manager
   * - status: 1 = active, 2 = disabled, etc.
   */
  async discoverAdAccounts(): Promise<MetaAdAccount[]> {
    const fields = ['id', 'name', 'account_status', 'business'];

    const response = await this.get<AdAccountsResponse>('me/adaccounts', {
      fields: fields.join(','),
      limit: 100, // Get up to 100 accounts
    });

    // Transform Meta API response to our internal format
    return response.data.map((account) => ({
      id: account.id,
      name: account.name,
      businessName: account.business?.name || 'Personal',
      status: account.account_status,
    }));
  }
}
