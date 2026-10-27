import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slaDays, suggestBureau, suggestPriority } from '../src/lib/complaints.js';

test('urgent wording is rated High, minor queries Low, everything else Medium', () => {
  assert.equal(suggestPriority('There is a fire risk in the hostel wing'), 'HIGH');
  assert.equal(suggestPriority('A minor query about the fee receipt'), 'LOW');
  assert.equal(suggestPriority('Lab equipment is outdated'), 'MEDIUM');
});

test('each category routes to a lead cell, with PGRC as the fallback', () => {
  assert.equal(suggestBureau('Academic'), 'ASC');
  assert.equal(suggestBureau('Infrastructure'), 'RB');
  assert.equal(suggestBureau('Other'), 'PGRC');
  assert.equal(suggestBureau('Unknown'), 'PGRC');
});

test('expected disposal days follow priority', () => {
  assert.equal(slaDays('HIGH'), 15);
  assert.equal(slaDays('MEDIUM'), 30);
  assert.equal(slaDays('LOW'), 45);
});
