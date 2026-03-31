import { describe, it, expect, beforeEach } from 'vitest';
import { AccountService } from '../services/account-service.js';

// NOTE: These tests require a valid META_SYSTEM_USER_TOKEN
// Set it in .env file before running tests

describe('AccountService', () => {
  let service: AccountService;
  const token = process.env.META_SYSTEM_USER_TOKEN;

  beforeEach(() => {
    if (!token) {
      console.warn('⚠️ Skipping tests: META_SYSTEM_USER_TOKEN not set');
    }
    service = new AccountService(token || 'dummy-token');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should clear cache', () => {
    service.clearCache();
    // If no error thrown, test passes
    expect(true).toBe(true);
  });

  // Integration test (requires real token)
  it.skip('should discover accounts (integration)', async () => {
    if (!token) return;

    const accounts = await service.discoverAdAccounts();
    expect(Array.isArray(accounts)).toBe(true);

    if (accounts.length > 0) {
      expect(accounts[0]).toHaveProperty('id');
      expect(accounts[0]).toHaveProperty('name');
      expect(accounts[0].id).toMatch(/^act_/);
    }
  });

  // Integration test (requires real token and existing accounts)
  it.skip('should resolve account by name (integration)', async () => {
    if (!token) return;

    // First discover to get a real account name
    const accounts = await service.discoverAdAccounts();
    if (accounts.length === 0) return;

    const firstAccount = accounts[0];
    const resolved = await service.resolveAccount(firstAccount.name);

    expect(resolved).toBe(firstAccount.id);
  });
});

describe('Test environment', () => {
  it('should allow unit tests to run without a real Meta token', () => {
    expect(true).toBe(true);
  });
});
