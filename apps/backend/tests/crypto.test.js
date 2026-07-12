import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { encryptToken, decryptToken, signState, verifyState } from '../src/lib/crypto.js';

describe('token encryption (AES-256-GCM)', () => {
  before(() => {
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = '0123456789abcdef'.repeat(4);
  });

  it('round-trips a token and never stores it in the clear', () => {
    const token = 'gho_secretUserToken123';
    const payload = encryptToken(token);
    assert.ok(!payload.includes(token));
    assert.equal(decryptToken(payload), token);
  });

  it('produces a different ciphertext per call (random IV)', () => {
    assert.notEqual(encryptToken('same'), encryptToken('same'));
  });

  it('rejects tampered ciphertext', () => {
    const payload = encryptToken('gho_abc');
    const [iv, tag, ct] = payload.split(':');
    const flipped = Buffer.from(ct, 'base64');
    flipped[0] ^= 0xff;
    assert.throws(() => decryptToken(`${iv}:${tag}:${flipped.toString('base64')}`));
  });

  it('fails loudly when the key env var is missing or malformed', () => {
    const saved = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
    delete process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
    assert.throws(() => encryptToken('x'), /GITHUB_TOKEN_ENCRYPTION_KEY/);
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = 'not-hex';
    assert.throws(() => encryptToken('x'), /GITHUB_TOKEN_ENCRYPTION_KEY/);
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = saved;
  });
});

describe('OAuth state signing', () => {
  before(() => {
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = '0123456789abcdef'.repeat(4);
  });

  it('round-trips the payload', () => {
    const state = signState({ u: 'user-uuid-1' });
    const decoded = verifyState(state);
    assert.equal(decoded.u, 'user-uuid-1');
  });

  it('rejects a forged signature', () => {
    const state = signState({ u: 'user-uuid-1' });
    const [body] = state.split('.');
    assert.equal(verifyState(`${body}.forgedsig`), null);
  });

  it('rejects a tampered body', () => {
    const state = signState({ u: 'victim' });
    const [, sig] = state.split('.');
    const evil = Buffer.from(JSON.stringify({ u: 'attacker', t: Date.now() })).toString('base64url');
    assert.equal(verifyState(`${evil}.${sig}`), null);
  });

  it('rejects an expired state', () => {
    const state = signState({ u: 'user-uuid-1' });
    assert.equal(verifyState(state, -1), null);
  });

  it('returns null on garbage input, never throws', () => {
    assert.equal(verifyState('not-a-state'), null);
    assert.equal(verifyState(''), null);
    assert.equal(verifyState('a.b'), null);
  });
});
