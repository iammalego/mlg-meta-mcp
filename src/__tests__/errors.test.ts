import { describe, it, expect } from 'vitest';
import { classifyMetaError, ErrorCategory, MetaMcpError } from '../utils/errors.js';

describe('classifyMetaError()', () => {
  it('classifies 401 as AUTH with invalid token message', () => {
    const error = classifyMetaError(401, { message: 'Token expired' });
    expect(error).toBeInstanceOf(MetaMcpError);
    expect(error.category).toBe(ErrorCategory.AUTH);
    expect(error.statusCode).toBe(401);
    expect(error.message).toContain('Token expired');
  });

  it('classifies 403 as AUTH with permissions message', () => {
    const error = classifyMetaError(403, { message: 'No access to this object' });
    expect(error.category).toBe(ErrorCategory.AUTH);
    expect(error.statusCode).toBe(403);
    expect(error.message).toContain('Insufficient permissions');
  });

  it('classifies 404 as NOT_FOUND', () => {
    const error = classifyMetaError(404, { message: 'Object does not exist' });
    expect(error.category).toBe(ErrorCategory.NOT_FOUND);
    expect(error.statusCode).toBe(404);
  });

  it('classifies 400 as VALIDATION', () => {
    const error = classifyMetaError(400, { message: 'Invalid parameter: status' });
    expect(error.category).toBe(ErrorCategory.VALIDATION);
    expect(error.statusCode).toBe(400);
    expect(error.message).toContain('Invalid parameters');
  });

  it('classifies 429 as RATE_LIMIT', () => {
    const error = classifyMetaError(429);
    expect(error.category).toBe(ErrorCategory.RATE_LIMIT);
    expect(error.statusCode).toBe(429);
  });

  it('classifies 500 as UNKNOWN server error', () => {
    const error = classifyMetaError(500, { message: 'Internal server error' });
    expect(error.category).toBe(ErrorCategory.UNKNOWN);
    expect(error.statusCode).toBe(500);
  });

  it('classifies 502 as UNKNOWN server error', () => {
    const error = classifyMetaError(502);
    expect(error.category).toBe(ErrorCategory.UNKNOWN);
    expect(error.statusCode).toBe(502);
  });

  it('classifies 503 as UNKNOWN server error', () => {
    const error = classifyMetaError(503);
    expect(error.category).toBe(ErrorCategory.UNKNOWN);
    expect(error.statusCode).toBe(503);
  });

  it('classifies unknown status codes as UNKNOWN', () => {
    const error = classifyMetaError(418);
    expect(error.category).toBe(ErrorCategory.UNKNOWN);
    expect(error.message).toContain('418');
  });

  it('uses fallback message when errorData is undefined', () => {
    const error = classifyMetaError(401);
    expect(error.message).toContain('Unknown Meta API error');
  });

  it('preserves the original error for stack traces', () => {
    const original = new Error('fetch failed');
    const error = classifyMetaError(500, undefined, original);
    expect(error.originalError).toBe(original);
  });
});

describe('MetaMcpError', () => {
  it('formats message with category prefix', () => {
    const error = new MetaMcpError(ErrorCategory.AUTH, 'Token expired');
    expect(error.message).toBe('[AUTH] Token expired');
  });

  it('has the correct name', () => {
    const error = new MetaMcpError(ErrorCategory.RATE_LIMIT, 'Too many requests');
    expect(error.name).toBe('MetaMcpError');
  });

  it('is an instance of Error', () => {
    const error = new MetaMcpError(ErrorCategory.NOT_FOUND, 'Not found');
    expect(error).toBeInstanceOf(Error);
  });
});
