// BYOK plumbing: header sanitization, request parsing, and key-aware routing.
// Run with: npx tsx tests/byok.test.ts

import assert from 'node:assert/strict';
import { keysFromRequest, sanitizeProviderKey, PROVIDER_KEY_HEADERS } from '../lib/provider-keys';
import { getRoutedModels, getImageModelCandidates, modelStatus } from '../lib/model-router';

// Routing reads process.env at call time — clear provider keys so results
// depend only on what each assertion passes in.
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
delete process.env.GOOGLE_API_KEY;

// --- sanitizeProviderKey ----------------------------------------------------

assert.equal(sanitizeProviderKey('sk-ant-abc123'), 'sk-ant-abc123');
assert.equal(sanitizeProviderKey('  sk-trimmed  '), 'sk-trimmed', 'whitespace is trimmed');
assert.equal(sanitizeProviderKey(''), undefined, 'empty is dropped');
assert.equal(sanitizeProviderKey('   '), undefined, 'blank is dropped');
assert.equal(sanitizeProviderKey('has a space'), undefined, 'inner whitespace is rejected');
assert.equal(sanitizeProviderKey('key\nwith-newline'), undefined, 'control characters are rejected');
assert.equal(sanitizeProviderKey('ключ'), undefined, 'non-ASCII is rejected');
assert.equal(sanitizeProviderKey('x'.repeat(257)), undefined, 'overlong values are rejected');
assert.equal(sanitizeProviderKey(42), undefined, 'non-strings are rejected');

// --- keysFromRequest --------------------------------------------------------

{
  const request = new Request('http://localhost/api/lesson', {
    headers: {
      [PROVIDER_KEY_HEADERS.anthropic]: 'sk-ant-valid',
      [PROVIDER_KEY_HEADERS.google]: 'bad key with spaces',
    },
  });
  const keys = keysFromRequest(request);
  assert.deepEqual(keys, { anthropic: 'sk-ant-valid' }, 'valid keys parse, junk is dropped');
}

{
  const keys = keysFromRequest(new Request('http://localhost/api/lesson'));
  assert.deepEqual(keys, {}, 'no headers means no keys');
}

// --- key-aware routing ------------------------------------------------------

assert.deepEqual(getRoutedModels('tutor'), [], 'no env keys, no BYOK keys: nothing routes');
assert.deepEqual(getImageModelCandidates(), [], 'no keys: no image models');

{
  const routed = getRoutedModels('tutor', { anthropic: 'sk-ant-test' });
  assert.ok(routed.length > 0, 'an Anthropic BYOK key routes tutor models');
  assert.ok(routed.every((entry) => entry.provider === 'anthropic'), 'only the keyed provider routes');
  assert.equal(routed[0].modelId, 'claude-opus-4-8', 'preference order is preserved');
}

{
  const routed = getRoutedModels('blackboard', { google: 'AIza-test' });
  assert.ok(routed.length > 0 && routed.every((entry) => entry.provider === 'google'));
}

{
  // Every role must route with any single provider's key — the panel promises
  // "one key from any provider makes lessons generate live".
  for (const provider of ['anthropic', 'openai', 'google'] as const) {
    for (const role of ['tutor', 'blackboard', 'fast'] as const) {
      const routed = getRoutedModels(role, { [provider]: 'test-key' });
      assert.ok(routed.length > 0, `${provider} key alone routes the ${role} role`);
    }
  }
}

{
  const candidates = getImageModelCandidates({ anthropic: 'sk-ant-test' });
  assert.deepEqual(candidates, [], 'Anthropic has no image models');
  const googleImages = getImageModelCandidates({ google: 'AIza-test' });
  assert.equal(googleImages[0]?.provider, 'google', 'a Google key enables image generation');
}

{
  const status = modelStatus({ openai: 'sk-test' });
  assert.deepEqual(status.keys, { anthropic: false, openai: true, google: false });
  assert.deepEqual(status.byok, { anthropic: false, openai: true, google: false });
  assert.ok(!JSON.stringify(status).includes('sk-test'), 'status never echoes key values');
}

{
  // Env keys still work with no BYOK keys (the self-hosting path).
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'env-google';
  const routed = getRoutedModels('fast');
  assert.ok(routed.length > 0 && routed.every((entry) => entry.provider === 'google'), 'env keys route without BYOK');
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
}

console.log('BYOK: all assertions passed.');
