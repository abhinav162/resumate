import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('aiService', () => {
  it('exports scoreResume, tailorResume, parseResumeText functions', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const { scoreResume, tailorResume, parseResumeText } = await import('../src/services/aiService.js');
    assert.equal(typeof scoreResume, 'function');
    assert.equal(typeof tailorResume, 'function');
    assert.equal(typeof parseResumeText, 'function');
  });
});
