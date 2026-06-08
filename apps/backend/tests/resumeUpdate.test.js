import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import database from '../src/config/database.js';
import { initializeDatabase } from '../src/config/initDb.js';
import { Resume } from '../src/models/Resume.js';

describe('Resume.update persists child sections', () => {
  before(async () => {
    process.env.DB_PATH = ':memory:';
    await database.close(); // fresh connection for test isolation
    await initializeDatabase();
  });

  it('persists edited experience responsibilities (regression: accepted suggestions reverted on reload)', async () => {
    const created = await Resume.create({
      name: 'Test',
      contact: { name: 'A', email: 'a@b.com' },
      summary: 'S',
      skills: ['x'],
      experience: [{ role: 'Dev', company: 'Acme', responsibilities: ['Old bullet'] }],
      education: [],
      projects: [],
    });
    assert.equal(created.experience[0].responsibilities[0], 'Old bullet');

    await Resume.update(created.id, {
      experience: [{ role: 'Dev', company: 'Acme', responsibilities: ['Increased lead discovery 30% via a Multi-Agent AI pipeline'] }],
    });

    const reloaded = await Resume.findByUuid(created.id);
    assert.equal(reloaded.experience.length, 1);
    assert.equal(
      reloaded.experience[0].responsibilities[0],
      'Increased lead discovery 30% via a Multi-Agent AI pipeline'
    );
  });

  it('persists added/reordered projects while leaving omitted sections untouched', async () => {
    const created = await Resume.create({
      name: 'T2',
      contact: { name: 'B', email: 'b@c.com' },
      summary: '',
      skills: [],
      experience: [],
      education: [{ degree: 'BS', institution: 'Uni' }],
      projects: [{ name: 'P1', description: ['a'] }],
    });

    await Resume.update(created.id, {
      projects: [
        { name: 'P1', description: ['a'] },
        { name: 'P2', description: ['b'] },
      ],
    });

    const reloaded = await Resume.findByUuid(created.id);
    assert.deepEqual(reloaded.projects.map((p) => p.name), ['P1', 'P2']);
    // Education was not in the update payload → left untouched.
    assert.equal(reloaded.education.length, 1);
  });

  it('leaves child tables untouched when no sections are provided', async () => {
    const created = await Resume.create({
      name: 'T3',
      contact: { name: 'C', email: 'c@d.com' },
      summary: '',
      skills: [],
      experience: [{ role: 'X', company: 'Y', responsibilities: ['keep me'] }],
      education: [],
      projects: [],
    });

    await Resume.update(created.id, { name: 'T3 renamed' });

    const reloaded = await Resume.findByUuid(created.id);
    assert.equal(reloaded.name, 'T3 renamed');
    assert.equal(reloaded.experience[0].responsibilities[0], 'keep me');
  });
});
