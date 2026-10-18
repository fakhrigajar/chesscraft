import { ImportError } from './importErrors.js';

const cache = new Map();
const abortError = () => new DOMException('Import cancelled', 'AbortError');

export function allowedSource(input) {
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) return false;
    return (url.hostname === 'lichess.org' && (/^\/api\/puzzle\/(daily|[A-Za-z0-9]{5})$/.test(url.pathname) || /^\/api\/study\/[A-Za-z0-9]{8}(\/[A-Za-z0-9]{8})?\.pgn$/.test(url.pathname))) || (url.hostname === 'api.chess.com' && url.pathname === '/pub/puzzle');
  } catch { return false; }
}

// Public APIs are fetched directly by the browser, including on static hosts.
export async function fetchPublicSource(url, { signal, asText = false, timeoutMs = 10000 } = {}) {
  if (signal?.aborted) throw abortError();
  if (!allowedSource(url)) throw new ImportError('unsupportedUrl');
  const key = `${asText ? 'pgn' : 'json'}:${url}`;
  const cached = cache.get(key);
  if (cached?.expires > Date.now()) return structuredClone(cached.data);
  cache.delete(key);

  const request = new AbortController();
  const cancel = () => request.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  // Keep the timeout even when the caller supplies a cancellation signal.
  const timer = setTimeout(cancel, timeoutMs);
  try {
    const response = await fetch(url, {
      signal: request.signal,
      credentials: 'omit',
      redirect: 'error',
      headers: { Accept: asText ? 'application/x-chess-pgn' : 'application/json' },
    });
    if (!response.ok) throw new ImportError(response.status === 429 ? 'rateLimit' : 'inaccessible', String(response.status));
    const data = await (asText ? response.text() : response.json());
    if (signal?.aborted) throw abortError();
    if (request.signal.aborted) throw new ImportError('networkTimeout');
    const ttl = !url.endsWith('/daily') && /\/api\/puzzle\/[A-Za-z0-9]{5}$/.test(url) ? 300000 : 60000;
    if (cache.size >= 50) cache.delete(cache.keys().next().value);
    cache.set(key, { data: structuredClone(data), expires: Date.now() + ttl });
    return data;
  } catch (error) {
    if (signal?.aborted) throw abortError();
    if (request.signal.aborted) throw new ImportError('networkTimeout');
    if (error instanceof ImportError) throw error;
    throw new ImportError('network', error.message);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
