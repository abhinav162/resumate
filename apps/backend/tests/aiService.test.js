import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('aiService', () => {
  it('exports scoreResume, tailorResume, parseResumeText functions', async () => {
    process.env.BIFROST_URL = 'https://bifrost.test';
    process.env.BIFROST_VIRTUAL_KEY = 'sk-bf-test';
    const { scoreResume, tailorResume, parseResumeText } = await import('../src/services/aiService.js');
    assert.equal(typeof scoreResume, 'function');
    assert.equal(typeof tailorResume, 'function');
    assert.equal(typeof parseResumeText, 'function');
  });
});
