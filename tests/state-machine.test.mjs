import test from 'node:test';
import assert from 'node:assert/strict';

const transitions = {
  requested: ['confirmed', 'cancelled'],
  confirmed: ['scheduled', 'cancelled'],
  delivered: ['completed']
};

test('valid transition requested -> confirmed', () => {
  assert.equal(transitions.requested.includes('confirmed'), true);
});

test('invalid transition confirmed -> completed', () => {
  assert.equal(transitions.confirmed.includes('completed'), false);
});
