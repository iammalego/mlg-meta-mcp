/**
 * Type definitions for mlg-meta-mcp
 */

// Meta API Types
export interface MetaAdAccount {
  id: string;
  name: string;
  businessName: string;
  status: number;
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  accountId?: string;
  dailyBudget?: number;
  lifetimeBudget?: number;
  createdTime: string;
}

export interface MetaAdSet {
  id: string;
  name: string;
  campaignId: string;
  status: string;
  dailyBudget?: number;
  lifetimeBudget?: number;
  targeting?: Record<string, unknown>;
  bidStrategy?: string;
  billingEvent?: string;
  optimizationGoal?: string;
  startTime?: string;
  endTime?: string;
}

export interface MetaAd {
  id: string;
  name: string;
  adSetId: string;
  campaignId?: string;
  status: string;
  creative?: {
    title?: string;
    body?: string;
    imageUrl?: string;
    linkUrl?: string;
    callToAction?: string;
  };
}

export interface MetaInsights {
  campaignId?: string;
  campaignName?: string;
  adsetId?: string;
  adsetName?: string;
  adId?: string;
  adName?: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm?: number;
  cpp?: number;
  actions?: Array<{
    actionType: string;
    value: string;
  }>;
  costPerActionType?: Array<{
    actionType: string;
    value: string;
  }>;
  dateStart: string;
  dateStop: string;
}

export interface MetaAdDetail {
  id: string;
  name: string;
  status: string;
  effectiveStatus: string;
  adSetId: string;
  campaignId: string;
  creativeId?: string;
  issuesInfo?: Array<{ error_code: number; error_message: string; level: string }>;
}

export interface MetaCreative {
  id: string;
  name: string;
  objectStorySpec?: Record<string, unknown>;
  imageHash?: string;
  callToAction?: { type: string };
}

export interface MetaTargetingItem {
  id: string;
  name: string;
  audienceSize?: number;
  path?: string[];
}

// MCP Tool Types
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// Error Types
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
    public statusCode?: number
  ) {
    super(`${category} ${message}`);
    this.name = 'MetaMcpError';
  }
}
