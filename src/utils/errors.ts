/**
 * Error Handling Utilities
 *
 * Classifies Meta API errors into categories for better UX.
 */

export enum ErrorCategory {
  AUTH = '[AUTH]',
  RATE_LIMIT = '[RATE_LIMIT]',
  NOT_FOUND = '[NOT_FOUND]',
  VALIDATION = '[VALIDATION]',
  NETWORK = '[NETWORK]',
  UNKNOWN = '[UNKNOWN]',
}

export class MetaMcpError extends Error {
  constructor(
    public category: ErrorCategory,
    message: string,
    public statusCode?: number,
    public originalError?: unknown
  ) {
    super(`${category} ${message}`);
    this.name = 'MetaMcpError';
  }
}

/**
 * Classifies a Meta API HTTP error into a category
 */
export function classifyMetaError(
  statusCode: number,
  errorData?: { message?: string; code?: number }
): MetaMcpError {
  const message = errorData?.message || 'Unknown Meta API error';

  switch (statusCode) {
    case 401:
      return new MetaMcpError(
        ErrorCategory.AUTH,
        `Invalid or expired token: ${message}`,
        statusCode
      );

    case 403:
      return new MetaMcpError(
        ErrorCategory.AUTH,
        `Insufficient permissions: ${message}`,
        statusCode
      );

    case 404:
      return new MetaMcpError(
        ErrorCategory.NOT_FOUND,
        `Resource not found: ${message}`,
        statusCode
      );

    case 400:
      return new MetaMcpError(
        ErrorCategory.VALIDATION,
        `Invalid parameters: ${message}`,
        statusCode
      );

    case 429:
      return new MetaMcpError(
        ErrorCategory.RATE_LIMIT,
        'Rate limit reached. Retrying...',
        statusCode
      );

    case 500:
    case 502:
    case 503:
      return new MetaMcpError(ErrorCategory.UNKNOWN, `Meta server error: ${message}`, statusCode);

    default:
      return new MetaMcpError(ErrorCategory.UNKNOWN, `Error ${statusCode}: ${message}`, statusCode);
  }
}
