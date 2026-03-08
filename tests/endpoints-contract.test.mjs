import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const content = fs.readFileSync('README.md', 'utf8');

test('README documents core endpoints', () => {
  assert.equal(content.includes('POST /api/bookings'), true);
  assert.equal(content.includes('POST /api/admin/bookings/{id}/status'), true);
  assert.equal(content.includes('POST /api/driver/jobs/{id}/status'), true);
});
