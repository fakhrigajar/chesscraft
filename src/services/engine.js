/** One serialized UCI channel. Cancellation drains bestmove before another position is sent. */
export class EngineService {
  constructor(workerFactory = () => new Worker(`${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`)) {
    this.workerFactory = workerFactory;
    this.status = 'idle';
    this.listeners = new Set();
    this.queue = Promise.resolve();
    this.cache = new Map();
    this.requestId = 0;
  }
  subscribe = fn => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  getSnapshot = () => this.status;
  setStatus(status) { this.status = status; this.listeners.forEach(fn => fn()); }
  async init() {
    if (this.status === 'ready') return;
    if (this.initializing) return this.initializing;
    this.setStatus('loading');
    this.initializing = new Promise((resolve, reject) => {
      let timer;
      const fail = error => {
        clearTimeout(timer);
        this.worker?.terminate();
        this.worker = null;
        this.setStatus('error');
        this.active?.reject(error);
        this.active = null;
        reject(error);
      };
      try {
        this.worker = this.workerFactory();
        this.worker.onerror = () => fail(new Error('The chess engine could not load. Please retry.'));
        timer = setTimeout(() => fail(new Error('Chess engine loading timed out.')), 20000);
        this.worker.onmessage = event => {
          const lines = String(event.data).split('\n');
          for (const line of lines) {
            if (line === 'uciok') {
              this.worker.postMessage('setoption name Hash value 16');
              this.worker.postMessage('isready');
            } else if (line === 'readyok' && this.status === 'loading') {
              clearTimeout(timer);
              this.setStatus('ready');
              resolve();
            } else this.active?.onLine(line);
          }
        };
        this.worker.postMessage('uci');
      } catch (error) { fail(error); }
    }).finally(() => { this.initializing = null; });
    return this.initializing;
  }
  analyze(fen, { depth = 16, movetime = 1000, multiPV = 3, searchmoves = [], signal, useCache = true } = {}) {
    // The half-move clock matters to the 50-move rule; do not cache only the board.
    const key = `${fen}|${depth}|${movetime}|${multiPV}|${searchmoves.join(',')}`;
    const run = async () => {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      if (useCache && this.cache.has(key)) return this.cache.get(key);
      await this.init();
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      return new Promise((resolve, reject) => {
        const variations = new Map(), id = ++this.requestId;
        let cancelled = false;
        const abort = () => { cancelled = true; this.worker?.postMessage('stop'); };
        signal?.addEventListener('abort', abort, { once: true });
        const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); this.active = null; };
        const timer = setTimeout(() => {
          cleanup();
          this.worker?.terminate(); this.worker = null; this.setStatus('error');
          reject(new Error('Chess analysis timed out. Please retry.'));
        }, movetime + 10000);
        this.active = {
          reject: error => { cleanup(); reject(error); },
          onLine: line => {
            if (line.startsWith('info ')) {
              const score = line.match(/score (cp|mate) (-?\d+)/), pv = line.match(/\spv (.+)$/), d = line.match(/\bdepth (\d+)/);
              if (score && pv && d) {
                const index = Number(line.match(/multipv (\d+)/)?.[1] || 1);
                const value = Number(score[2]);
                const info = { depth: Number(d[1]), pv: pv[1].trim().split(' '), score: { type: score[1], value }, whiteScore: { type: score[1], value: value * (fen.split(' ')[1] === 'w' ? 1 : -1) }, bound: /lowerbound|upperbound/.test(line) };
                const prior = variations.get(index);
                if (!prior || info.depth >= prior.depth) variations.set(index, info);
              }
            } else if (line.startsWith('bestmove ')) {
              cleanup();
              if (cancelled) return reject(new DOMException('Cancelled', 'AbortError'));
              const result = { id, fen, bestmove: line.split(' ')[1], variations: [...variations.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v) };
              if (useCache && result.variations.length) {
                this.cache.set(key, result);
                if (this.cache.size > 150) this.cache.delete(this.cache.keys().next().value);
              }
              resolve(result);
            }
          },
        };
        this.worker.postMessage(`setoption name MultiPV value ${multiPV}`);
        this.worker.postMessage(`position fen ${fen}`);
        this.worker.postMessage(`go depth ${depth} movetime ${movetime}${searchmoves.length ? ` searchmoves ${searchmoves.join(' ')}` : ''}`);
      });
    };
    const request = this.queue.then(run, run);
    this.queue = request.catch(() => {});
    return request;
  }
  retry() { this.worker?.terminate(); this.worker = null; this.initializing = null; this.setStatus('idle'); return this.init(); }
}
export const engine = new EngineService();
export const scoreFor = (variation, color) => variation?.whiteScore ? { ...variation.whiteScore, value: variation.whiteScore.value * (color === 'w' ? 1 : -1) } : null;
