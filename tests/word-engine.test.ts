import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildShareLink,
  buildWordDatabase,
  pickRandomWord,
  chooseFakeArtistCount,
  resolveTieVotes
} from '../src/utils/wordEngine.ts';

test('buildWordDatabase creates large category collections', () => {
  const db = buildWordDatabase();
  assert.ok(Object.keys(db).length >= 12);
  assert.ok(db.Animals.length >= 25);
  assert.ok(db['People & Professions'].length >= 12);
});

test('pickRandomWord picks from the correct category and avoids duplicates', () => {
  const db = buildWordDatabase();
  const chosen = pickRandomWord('Animals', 'easy', db.Animals.slice(0, 3));
  assert.ok(db.Animals.includes(chosen));
  assert.ok(!db.Animals.slice(0, 3).includes(chosen));
});

test('fake artist count scales with player count', () => {
  assert.deepEqual(chooseFakeArtistCount(2), [1]);
  assert.deepEqual(chooseFakeArtistCount(6), [1]);
  assert.deepEqual(chooseFakeArtistCount(8), [2]);
  assert.deepEqual(chooseFakeArtistCount(10), [2, 3]);
});

test('tie resolution is deterministic and fair', () => {
  const votes = { a: 'b', b: 'c', c: 'b', d: 'c' };
  const result = resolveTieVotes(votes, ['a', 'b', 'c', 'd']);
  assert.equal(result, 'c');
});

test('share links use the public host instead of localhost', () => {
  const link = buildShareLink('https://zsgttwlf-3000.inc1.devtunnels.ms', '35UD8V', 'game');
  assert.equal(link, 'https://zsgttwlf-3000.inc1.devtunnels.ms?room=35UD8V&mode=game');
});
