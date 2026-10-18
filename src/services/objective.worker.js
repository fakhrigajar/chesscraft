import { proveObjective } from './objectives.js';
self.onmessage = ({ data }) => {
  try { self.postMessage({ id: data.id, ...proveObjective(data.fen, data.objective, data.side, data.remaining, data.options) }); }
  catch (error) { self.postMessage({ id: data.id, result: null, error: error.message }); }
};
