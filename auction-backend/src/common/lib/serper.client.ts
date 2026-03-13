/**
 * Thin HTTP client for the Serper Google Search API.
 * Returns organic results only; errors and timeouts return an empty array.
 */

export interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
  position?: number;
}

export interface SerperSearchConfig {
  apiKey: string;
  defaultMarket: string;
  timeoutMs: number;
  maxResults: number;
}

export async function searchSerper(
  query: string,
  config: SerperSearchConfig,
): Promise<SerperOrganicResult[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        gl: 'in',
        hl: 'en',
        num: config.maxResults,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as { organic?: SerperOrganicResult[] };
    return data.organic ?? [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
