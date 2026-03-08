import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();

async function withIdempotency(key, run) {
  if (store.has(key)) return store.get(key);
  const value = await run();
  store.set(key, value);
  return value;
}

test('idempotency returns original result', async () => {
  let count = 0;
  const run = async () => ({ value: ++count });
  const first = await withIdempotency('k1', run);
  const second = await withIdempotency('k1', run);
  assert.deepEqual(first, second);
  assert.equal(count, 1);
});
