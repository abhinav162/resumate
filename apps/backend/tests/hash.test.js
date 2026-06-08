import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stableStringify, contentHash } from '../src/lib/scoring/hash.js';

describe('scoring/hash', () => {
  it('stableStringify is independent of object key order', () => {
    const a = { b: 1, a: 2, nested: { y: 1, x: 2 } };
    const b = { a: 2, nested: { x: 2, y: 1 }, b: 1 };
    assert.equal(stableStringify(a), stableStringify(b));
  });

  it('contentHash is identical for equal content, different when content changes', () => {
    const resume = {
      summary: 'Engineer',
      experience: [{ role: 'Dev', responsibilities: ['Built X', 'Shipped Y'] }],
    };
    const same = JSON.parse(JSON.stringify(resume));
    assert.equal(contentHash(resume), contentHash(same));

    const changed = JSON.parse(JSON.stringify(resume));
    changed.experience[0].responsibilities[0] = 'Built Z';
    assert.notEqual(contentHash(resume), contentHash(changed));
  });

  it('contentHash returns a 64-char hex sha256', () => {
    const h = contentHash({ a: 1 });
    assert.match(h, /^[0-9a-f]{64}$/);
  });
});
