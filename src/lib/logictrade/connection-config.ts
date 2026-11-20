/**
 * Centralized LogicTrade Connection & Authentication Configuration SSOT
 */

export interface LogicTradeConnectionConfig {
  baseUrl: string;
  apiKey: string;
}

export interface LogicTradeConnectionOptions {
  baseUrl?: string;
  apiKey?: string;
  requireApiKey?: boolean;
}

const DEFAULT_BASE_URL = 'https://api.logictrade.cloud/rest/v1';

export function resolveLogicTradeConnectionConfig(
  options?: LogicTradeConnectionOptions
): LogicTradeConnectionConfig {
  const baseUrl = options?.baseUrl || process.env.LOGICTRADE_BASE_URL || DEFAULT_BASE_URL;
  const apiKey =
    options?.apiKey ||
    process.env.LOGICTRADE_API_KEY ||
    process.env.LOGICTRADE_VENDOR_API_KEY ||
    '';

  if (options?.requireApiKey && !apiKey) {
    throw new Error(
      'LOGICTRADE_API_KEY or LOGICTRADE_VENDOR_API_KEY is required but missing in environment or options.'
    );
  }

  return {
    baseUrl,
    apiKey,
  };
}
