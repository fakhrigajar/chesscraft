import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePuzzle } from '../src/services/storage.js';
import { readFileSync } from 'node:fs';
import { importPgn } from '../src/services/importers.js';

test('older saved puzzles retain their English content and chess data without locale fields', () => {
  const saved = { id: 'saved', title: 'Original title', titleEn: 'English title', description: 'Original description', descriptionEn: 'English description', initialFen: 'fen', solution: ['g1f3'], objective: { type: 'reach', target: 'f3' } };
  const result = normalizePuzzle(saved);
  assert.equal(result.title, 'English title');
  assert.equal(result.description, 'English description');
  assert.equal(result.initialFen, saved.initialFen);
  assert.deepEqual(result.solution, saved.solution);
  assert.deepEqual(result.objective, saved.objective);
  assert.equal('titleEn' in result, false);
  assert.equal('descriptionEn' in result, false);
  assert.equal(saved.title, 'Original title');
});

test('single-language custom puzzle content survives normalization and repeated saves', () => {
  const saved = { id: 'custom', title: 'My own lesson', description: 'My own instructions', titleEn: '', descriptionEn: '' };
  const result = normalizePuzzle(saved);
  assert.equal(result.title, saved.title);
  assert.equal(result.description, saved.description);
  assert.deepEqual(normalizePuzzle(result), result);
});

test('legacy Windmill saves recover the source move limit while later teacher overrides are preserved', () => {
  const legacy = importPgn(readFileSync(new URL('./fixtures/lichess-study.pgn', import.meta.url), 'utf8'));
  delete legacy.importVersion;
  legacy.objective.moves = 8;
  const repaired = normalizePuzzle(legacy);
  assert.equal(repaired.objective.moves, 12);
  assert.equal(repaired.id, legacy.id);
  assert.deepEqual(repaired.solution, legacy.solution);
  assert.equal(legacy.objective.moves, 8);
  repaired.objective.moves = 8;
  assert.equal(normalizePuzzle(repaired).objective.moves, 8);
});

test('older PGNs with the generic one-move default recover their recorded endpoint once', () => {
  const legacy = importPgn(readFileSync(new URL('./fixtures/opening-study.pgn', import.meta.url), 'utf8'));
  legacy.importVersion = 2;
  delete legacy.recordedObjective;
  legacy.objective.moves = 1;
  const repaired = normalizePuzzle(legacy);
  assert.equal(repaired.importVersion, 3);
  assert.equal(repaired.objective.moves, 2);
  assert.deepEqual(repaired.recordedObjective, repaired.objective);
  repaired.objective = { ...repaired.objective, moves: 1 };
  assert.equal(normalizePuzzle(repaired).objective.moves, 1);
});
