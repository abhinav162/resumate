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

  // M2.8.1 — GitHub project provenance
  it('githubRepoId round-trips create → find → update → find; manual projects stay null', async () => {
    const created = await Resume.create({
      name: 'M28',
      contact: { name: 'D', email: 'd@e.com' },
      summary: '',
      skills: [],
      experience: [],
      education: [],
      projects: [
        { name: 'Imported', description: ['x'], githubRepoId: 'R_abc' },
        { name: 'Manual', description: ['y'] },
      ],
    });

    assert.equal(created.projects.length, 2);
    assert.equal(created.projects[0].githubRepoId, 'R_abc');
    assert.equal(created.projects[1].githubRepoId, null, 'manual project must be null');

    await Resume.update(created.id, {
      projects: [
        { name: 'Imported v2', description: ['x2'], githubRepoId: 'R_abc' },
        { name: 'Manual', description: ['y'] },
      ],
    });

    const reloaded = await Resume.findByUuid(created.id);
    assert.equal(reloaded.projects.length, 2);
    assert.equal(reloaded.projects[0].name, 'Imported v2');
    assert.equal(reloaded.projects[0].githubRepoId, 'R_abc', 'githubRepoId survives update');
    assert.equal(reloaded.projects[1].githubRepoId, null);
  });

  it('update payload with two projects sharing a githubRepoId persists only the first', async () => {
    const created = await Resume.create({
      name: 'M28-dupe',
      contact: { name: 'E', email: 'e@f.com' },
      summary: '',
      skills: [],
      experience: [],
      education: [],
      projects: [],
    });

    await Resume.update(created.id, {
      projects: [
        { name: 'First copy', description: ['a'], githubRepoId: 'R_dup' },
        { name: 'Second copy', description: ['b'], githubRepoId: 'R_dup' },
      ],
    });

    const reloaded = await Resume.findByUuid(created.id);
    assert.equal(reloaded.projects.length, 1, 'duplicate githubRepoId must be dropped');
    assert.equal(reloaded.projects[0].name, 'First copy', 'the FIRST occurrence wins');
    assert.equal(reloaded.projects[0].githubRepoId, 'R_dup');
  });

  it('two projects with null githubRepoId are NOT deduped', async () => {
    const created = await Resume.create({
      name: 'M28-nulls',
      contact: { name: 'F', email: 'f@g.com' },
      summary: '',
      skills: [],
      experience: [],
      education: [],
      projects: [],
    });

    await Resume.update(created.id, {
      projects: [
        { name: 'Manual A', description: ['a'], githubRepoId: null },
        { name: 'Manual B', description: ['b'] }, // undefined id
      ],
    });

    const reloaded = await Resume.findByUuid(created.id);
    assert.equal(reloaded.projects.length, 2, 'null/undefined ids must never dedupe');
    assert.deepEqual(reloaded.projects.map((p) => p.name), ['Manual A', 'Manual B']);
    assert.deepEqual(reloaded.projects.map((p) => p.githubRepoId), [null, null]);
  });
});
