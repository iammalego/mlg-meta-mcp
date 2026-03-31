/**
 * Base HTTP Client for Meta API
 *
 * Maneja:
 * - Autenticación automática
 * - Retries con backoff exponencial
 * - Error classification
 * - Rate limiting
 */

import { config } from '../config/index.js';
import { getLogger } from '../utils/logger.js';
import { classifyMetaError, MetaMcpError, ErrorCategory } from '../utils/errors.js';

const logger = getLogger();

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  params?: Record<string, string | number | boolean | object>;
  body?: Record<string, unknown>;
  retries?: number;
}

export class MetaApiClient {
  protected baseUrl: string;
  protected accessToken: string;

  constructor(accessToken: string, apiVersion: string = config.META_API_VERSION) {
    this.accessToken = accessToken;
    this.baseUrl = `https://graph.facebook.com/${apiVersion}`;
  }

  /**
   * Make an HTTP request to Meta API with retries
   */
  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', params = {}, body, retries = config.MAX_RETRIES } = options;

    const url = new URL(`${this.baseUrl}/${endpoint}`);

    // Always add access token
    url.searchParams.set('access_token', this.accessToken);

    // Add query params
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        url.searchParams.set(key, stringValue);
      }
    }

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    // Retry loop with exponential backoff
    let lastError: MetaMcpError | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        logger.debug(
          {
            endpoint,
            method,
            attempt: attempt + 1,
            totalRetries: retries,
          },
          'API request'
        );

        const response = await fetch(url.toString(), fetchOptions);
        const data = (await response.json()) as Record<string, unknown>;

        // Handle API errors
        if (!response.ok || data.error) {
          const errorData = data.error as { message?: string; code?: number } | undefined;
          const error = classifyMetaError(response.status, errorData);

          // Don't retry client errors (4xx) except rate limit
          if (response.status !== 429 && response.status >= 400 && response.status < 500) {
            throw error;
          }

          lastError = error;

          // If it's rate limit, wait and retry
          if (response.status === 429 && attempt < retries) {
            const delay = config.RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
            logger.warn({ delayMs: delay }, 'Rate limited, retrying...');
            await sleep(delay);
            continue;
          }

          throw error;
        }

        // Success!
        return data as T;
      } catch (error) {
        // Network errors (fetch throws on network issues)
        if (
          error instanceof TypeError ||
          (error instanceof Error && error.message.includes('fetch'))
        ) {
          lastError = new MetaMcpError(
            ErrorCategory.NETWORK,
            `Error de red: ${(error as Error).message}`,
            undefined,
            error
          );

          if (attempt < retries) {
            const delay = config.RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
            logger.warn({ delayMs: delay }, 'Network error, retrying...');
            await sleep(delay);
            continue;
          }
        }

        // Re-throw MetaMcpError or wrap unknown errors
        if (error instanceof MetaMcpError) {
          throw error;
        }

        throw new MetaMcpError(
          ErrorCategory.UNKNOWN,
          `Error inesperado: ${(error as Error).message}`,
          undefined,
          error
        );
      }
    }

    // If we exhausted all retries
    throw lastError || new MetaMcpError(ErrorCategory.UNKNOWN, 'Se agotaron los reintentos');
  }

  /**
   * Convenience method for GET requests
   */
  async get<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | object>
  ): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  /**
   * Convenience method for POST requests
   */
  async post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
