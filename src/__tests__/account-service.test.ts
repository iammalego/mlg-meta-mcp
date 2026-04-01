import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccountService } from '../services/account-service.js';
import type { MetaAdAccount } from '../types/index.js';

// Declare the mock function at module level so we can reference it directly.
// vi.mock() is hoisted to the top of the file by Vitest, so this function
// will be wired in before any test runs.
const mockDiscoverAdAccounts = vi.fn();

vi.mock('../api/business-client.js', () => ({
  BusinessClient: vi.fn().mockImplementation(() => ({
    discoverAdAccounts: mockDiscoverAdAccounts,
  })),
}));

const MOCK_ACCOUNTS: MetaAdAccount[] = [
  { id: 'act_111', name: 'Agencia Norte', businessName: 'Norte SRL', status: 1 },
  { id: 'act_222', name: 'Cliente Sur', businessName: 'Sur SA', status: 1 },
  { id: 'act_333', name: 'Plannit', businessName: 'Plannit Inc', status: 1 },
];

describe('AccountService', () => {
  let service: AccountService;

  beforeEach(() => {
    service = new AccountService('dummy-token');
    mockDiscoverAdAccounts.mockResolvedValue(MOCK_ACCOUNTS);
  });

  describe('resolveAccount()', () => {
    it('returns the ID as-is when it starts with act_', async () => {
      // If you already have the ID, no API call is needed
      const result = await service.resolveAccount('act_999');
      expect(result).toBe('act_999');
      expect(mockDiscoverAdAccounts).not.toHaveBeenCalled();
    });

    it('resolves an account name to its ID', async () => {
      const result = await service.resolveAccount('Plannit');
      expect(result).toBe('act_333');
    });

    it('resolves account names case-insensitively', async () => {
      const result = await service.resolveAccount('plannit');
      expect(result).toBe('act_333');
    });

    it('throws a descriptive error when the account name does not exist', async () => {
      await expect(service.resolveAccount('Cuenta Fantasma')).rejects.toThrow(
        'Account not found: "Cuenta Fantasma"'
      );
    });

    it('error message lists all available accounts', async () => {
      await expect(service.resolveAccount('Inexistente')).rejects.toThrow('Agencia Norte');
    });
  });

  describe('discoverAdAccounts()', () => {
    it('returns all discovered accounts', async () => {
      const accounts = await service.discoverAdAccounts();
      expect(accounts).toHaveLength(3);
      expect(accounts[0].id).toBe('act_111');
    });

    it('caches results and only calls the API once', async () => {
      await service.discoverAdAccounts();
      await service.discoverAdAccounts();
      expect(mockDiscoverAdAccounts).toHaveBeenCalledTimes(1);
    });

    it('re-fetches after cache is cleared', async () => {
      await service.discoverAdAccounts();
      service.clearCache();
      await service.discoverAdAccounts();
      expect(mockDiscoverAdAccounts).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAccount()', () => {
    it('returns the full account object when found by ID', async () => {
      const account = await service.getAccount('act_222');
      expect(account.name).toBe('Cliente Sur');
    });

    it('returns the full account object when found by name', async () => {
      const account = await service.getAccount('Agencia Norte');
      expect(account.id).toBe('act_111');
    });
  });
});

// Integration tests — only run when a real META_SYSTEM_USER_TOKEN is available
const realToken = process.env.META_SYSTEM_USER_TOKEN;
describe.skipIf(!realToken)('AccountService (integration)', () => {
  let service: AccountService;

  beforeEach(() => {
    service = new AccountService(realToken!);
  });

  it('discovers real accounts from Meta API', async () => {
    const accounts = await service.discoverAdAccounts();
    expect(Array.isArray(accounts)).toBe(true);
    if (accounts.length > 0) {
      expect(accounts[0].id).toMatch(/^act_/);
    }
  });

  it('resolves a real account name to its ID', async () => {
    const accounts = await service.discoverAdAccounts();
    if (accounts.length === 0) return;
    const resolved = await service.resolveAccount(accounts[0].name);
    expect(resolved).toBe(accounts[0].id);
  });
});
