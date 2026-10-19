/**
 * Rate Limiter & Adaptive Backoff Engine voor LogicTrade Cloud REST API.
 * Garandeert strikte naleving van de vendor limieten (doc-345579: max 1020 req/min)
 * door conservatieve pacing (150ms delay, ~400 req/min) en automatische circuit breaking bij HTTP 429/503.
 */

export interface RateLimiterOptions {
  minDelayMs?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RateLimiter {
  private minDelayMs: number;
  private maxRetries: number;
  private baseBackoffMs: number;
  private lastRequestTime = 0;

  constructor(options: RateLimiterOptions = {}) {
    this.minDelayMs = options.minDelayMs ?? 150; // Max ~6.6 req/s = ~400 req/min (ruimschoots onder 1020 quotum)
    this.maxRetries = options.maxRetries ?? 3;
    this.baseBackoffMs = options.baseBackoffMs ?? 5000; // 5 seconden initiële backoff bij 429
  }

  /**
   * Zorgt voor een gegarandeerde pacing pauze tussen opeenvolgende HTTP verzoeken.
   */
  async pace(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minDelayMs) {
      await sleep(this.minDelayMs - elapsed);
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Voert een fetch-aanroep uit met automatische pacing, 429/503 detectie en exponentiële backoff.
   */
  async fetchWithAdaptiveBackoff(
    url: string | URL,
    init?: RequestInit
  ): Promise<Response> {
    let attempt = 0;

    while (true) {
      await this.pace();

      try {
        const response = await fetch(url, init);

        // Als we 429 (Too Many Requests) of 503 (Service Unavailable) krijgen:
        if (response.status === 429 || response.status === 503) {
          attempt++;
          if (attempt > this.maxRetries) {
            throw new Error(
              `RateLimiter: Maximaal aantal herhaalpogingen (${this.maxRetries}) overschreden bij HTTP ${response.status}.`
            );
          }

          // Exponentiële backoff: 5s, 10s, 20s...
          const backoffTime = this.baseBackoffMs * Math.pow(2, attempt - 1);
          console.warn(
            `[RateLimiter] HTTP ${response.status} ontvangen. Circuit breaker geactiveerd: pauzeer ${backoffTime}ms (poging ${attempt}/${this.maxRetries})...`
          );
          await sleep(backoffTime);
          continue;
        }

        return response;
      } catch (err: any) {
        // Netwerk time-outs of socket errors herhalen
        if (attempt < this.maxRetries && (err.name === 'AbortError' || err.code === 'ECONNRESET' || err.message?.includes('fetch failed'))) {
          attempt++;
          const backoffTime = this.baseBackoffMs * Math.pow(2, attempt - 1);
          console.warn(`[RateLimiter] Netwerkfout (${err.message}). Pauzeer ${backoffTime}ms en probeer opnieuw...`);
          await sleep(backoffTime);
          continue;
        }
        throw err;
      }
    }
  }
}

export const defaultRateLimiter = new RateLimiter();
