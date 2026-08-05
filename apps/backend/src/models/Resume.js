import database from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

class Resume {
  constructor(data) {
    this.id = data.id;
    this.uuid = data.uuid || uuidv4();
    this.userId = data.userId;
    this.name = data.name;
    this.contactData = data.contactData;
    this.summary = data.summary;
    this.skills = data.skills;
    this.isBase = data.isBase || false;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  static async create(resumeData) {
    const uuid = uuidv4();
    const contactDataJson = JSON.stringify(resumeData.contact);
    const skillsJson = JSON.stringify(resumeData.skills);
    
    // Handle default-user case by getting the default user ID
    let userId = resumeData.userId;
    if (userId === 'default-user') {
      userId = await Resume.getDefaultUserId();
    }
    
    const result = await database.run(`
      INSERT INTO base_resumes (uuid, user_id, name, contact_data, summary, skills, is_base)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      uuid,
      userId || null,
      resumeData.name,
      contactDataJson,
      resumeData.summary,
      skillsJson,
      resumeData.isBase ? 1 : 0
    ]);

    // Create associated experiences, education, and projects
    if (resumeData.experience) {
      await Promise.all(resumeData.experience.map((exp, index) => 
        Experience.create({ ...exp, resumeId: result.id, displayOrder: index })
      ));
    }

    if (resumeData.education) {
      await Promise.all(resumeData.education.map((edu, index) => 
        Education.create({ ...edu, resumeId: result.id, displayOrder: index })
      ));
    }

    if (resumeData.projects) {
      // Dedupe by githubRepoId — guards against double-adding the same GitHub repo.
      await Promise.all(dedupeProjectsByGithubRepoId(resumeData.projects).map((proj, index) =>
        Project.create({ ...proj, resumeId: result.id, displayOrder: index })
      ));
    }

    return await Resume.findByUuid(uuid);
  }

  static async findByUuid(uuid) {
    const resume = await database.get(`
      SELECT * FROM base_resumes WHERE uuid = ?
    `, [uuid]);

    if (!resume) return null;

    // Get associated data
    const experiences = await Experience.findByResumeId(resume.id);
    const education = await Education.findByResumeId(resume.id);
    const projects = await Project.findByResumeId(resume.id);

    return {
      id: resume.uuid,
      name: resume.name,
      contact: JSON.parse(resume.contact_data),
      summary: resume.summary,
      skills: JSON.parse(resume.skills),
      experience: experiences,
      education: education,
      projects: projects,
      isBase: resume.is_base === 1,
      createdAt: resume.created_at,
      updatedAt: resume.updated_at
    };
  }

  static async findByUserId(userId) {
    const resumes = await database.all(`
      SELECT * FROM base_resumes WHERE user_id = ? OR user_id IS NULL
      ORDER BY created_at DESC
    `, [userId]);

    return Promise.all(resumes.map(resume => Resume.findByUuid(resume.uuid)));
  }

  static async update(uuid, updateData) {
    const updates = [];
    const values = [];

    if (updateData.name) {
      updates.push('name = ?');
      values.push(updateData.name);
    }
    if (updateData.contact) {
      updates.push('contact_data = ?');
      values.push(JSON.stringify(updateData.contact));
    }
    if (updateData.summary !== undefined) {
      updates.push('summary = ?');
      values.push(updateData.summary);
    }
    if (updateData.skills) {
      updates.push('skills = ?');
      values.push(JSON.stringify(updateData.skills));
    }
    if (updateData.isBase !== undefined) {
      updates.push('is_base = ?');
      values.push(updateData.isBase ? 1 : 0);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(uuid);

    await database.run(`
      UPDATE base_resumes SET ${updates.join(', ')} WHERE uuid = ?
    `, values);

    // Persist child sections (experience / education / projects) when provided.
    // The editor sends the full arrays on every save, so we replace the rows
    // wholesale — this mirrors create and is why accepted edits/reorders survive
    // a reload. Sections omitted from updateData are left untouched.
    if (updateData.experience || updateData.education || updateData.projects) {
      const row = await database.get('SELECT id FROM base_resumes WHERE uuid = ?', [uuid]);
      if (row) {
        if (updateData.experience) {
          await database.run('DELETE FROM experiences WHERE resume_id = ?', [row.id]);
          await Promise.all(updateData.experience.map((exp, index) =>
            Experience.create({ ...exp, resumeId: row.id, displayOrder: index })
          ));
        }
        if (updateData.education) {
          await database.run('DELETE FROM education WHERE resume_id = ?', [row.id]);
          await Promise.all(updateData.education.map((edu, index) =>
            Education.create({ ...edu, resumeId: row.id, displayOrder: index })
          ));
        }
        if (updateData.projects) {
          await database.run('DELETE FROM projects WHERE resume_id = ?', [row.id]);
          // Dedupe by githubRepoId — guards against double-adding the same GitHub repo.
          await Promise.all(dedupeProjectsByGithubRepoId(updateData.projects).map((proj, index) =>
            Project.create({ ...proj, resumeId: row.id, displayOrder: index })
          ));
        }
      }
    }

    return await Resume.findByUuid(uuid);
  }

  static async delete(uuid) {
    const result = await database.run(`
      DELETE FROM base_resumes WHERE uuid = ?
    `, [uuid]);

    return result.changes > 0;
  }

  static async getDefaultUserId() {
    // Get the default user ID (should always exist after DB init)
    const user = await database.get(`
      SELECT id FROM users WHERE uuid = ?
    `, ['default-user']);

    if (!user) {
      throw new Error('Default user not found. Database may not be properly initialized.');
    }

    return user.id;
  }
}

class Experience {
  static async create(expData) {
    const uuid = uuidv4();
    const responsibilitiesJson = JSON.stringify(expData.responsibilities || []);

    await database.run(`
      INSERT INTO experiences (uuid, resume_id, role, company, location, start_date, end_date, responsibilities, display_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      uuid,
      expData.resumeId,
      expData.role ?? '',
      expData.company ?? '',
      expData.location ?? null,
      expData.startDate ?? null,
      expData.endDate ?? null,
      responsibilitiesJson,
      expData.displayOrder || 0
    ]);

    return uuid;
  }

  static async findByResumeId(resumeId) {
    const experiences = await database.all(`
      SELECT * FROM experiences WHERE resume_id = ? ORDER BY display_order
    `, [resumeId]);

    return experiences.map(exp => ({
      id: exp.uuid,
      role: exp.role,
      company: exp.company,
      location: exp.location,
      startDate: exp.start_date,
      endDate: exp.end_date,
      responsibilities: JSON.parse(exp.responsibilities)
    }));
  }
}

class Education {
  static async create(eduData) {
    const uuid = uuidv4();

    await database.run(`
      INSERT INTO education (uuid, resume_id, degree, institution, location, graduation_date, gpa, display_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      uuid,
      eduData.resumeId,
      eduData.degree ?? '',
      eduData.institution ?? '',
      eduData.location ?? null,
      eduData.graduationDate ?? null,
      eduData.gpa ?? null,
      eduData.displayOrder || 0
    ]);

    return uuid;
  }

  static async findByResumeId(resumeId) {
    const education = await database.all(`
      SELECT * FROM education WHERE resume_id = ? ORDER BY display_order
    `, [resumeId]);

    return education.map(edu => ({
      id: edu.uuid,
      degree: edu.degree,
      institution: edu.institution,
      location: edu.location,
      graduationDate: edu.graduation_date,
      gpa: edu.gpa
    }));
  }
}

// M2.8: drop projects whose non-null githubRepoId was already seen in this
// batch (keep first); manual projects (null/undefined id) are never deduped.
function dedupeProjectsByGithubRepoId(projects) {
  const seen = new Set();
  return projects.filter((proj) => {
    const repoId = proj?.githubRepoId;
    if (repoId === null || repoId === undefined) return true;
    if (seen.has(repoId)) return false;
    seen.add(repoId);
    return true;
  });
}

class Project {
  static async create(projData) {
    const uuid = uuidv4();
    const descriptionJson = JSON.stringify(projData.description || []);

    await database.run(`
      INSERT INTO projects (uuid, resume_id, name, url, repo_url, description, display_order, github_repo_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      uuid,
      projData.resumeId,
      projData.name ?? '',
      projData.url ?? null,
      projData.repoUrl ?? null,
      descriptionJson,
      projData.displayOrder || 0,
      projData.githubRepoId ?? null
    ]);

    return uuid;
  }

  static async findByResumeId(resumeId) {
    const projects = await database.all(`
      SELECT * FROM projects WHERE resume_id = ? ORDER BY display_order
    `, [resumeId]);

    return projects.map(proj => ({
      id: proj.uuid,
      name: proj.name,
      url: proj.url,
      repoUrl: proj.repo_url,
      description: JSON.parse(proj.description),
      githubRepoId: proj.github_repo_id ?? null
    }));
  }
}

export { Resume, Experience, Education, Project };