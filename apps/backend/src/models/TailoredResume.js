import database from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

class TailoredResume {
  constructor(data) {
    this.id = data.id;
    this.uuid = data.uuid || uuidv4();
    this.baseResumeId = data.baseResumeId;
    this.jobTitle = data.jobTitle;
    this.company = data.company;
    this.jobDescription = data.jobDescription;
    this.tailoredData = data.tailoredData;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  static async create(tailoredData) {
    const uuid = uuidv4();
    const tailoredDataJson = JSON.stringify(tailoredData.tailoredData);
    
    // First, get the internal ID of the base resume
    const baseResume = await database.get(`
      SELECT id FROM base_resumes WHERE uuid = ?
    `, [tailoredData.baseResumeId]);

    if (!baseResume) {
      throw new Error('Base resume not found');
    }

    const result = await database.run(`
      INSERT INTO tailored_resumes (uuid, base_resume_id, job_title, company, job_description, tailored_data)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      uuid,
      baseResume.id,
      tailoredData.jobDetails.jobTitle,
      tailoredData.jobDetails.company,
      tailoredData.jobDetails.description,
      tailoredDataJson
    ]);

    return await TailoredResume.findByUuid(uuid);
  }

  static async findByUuid(uuid) {
    const tailoredResume = await database.get(`
      SELECT tr.*, br.uuid as base_resume_uuid, br.user_id as user_id
      FROM tailored_resumes tr
      JOIN base_resumes br ON tr.base_resume_id = br.id
      WHERE tr.uuid = ?
    `, [uuid]);

    if (!tailoredResume) return null;

    return {
      id: tailoredResume.uuid,
      baseResumeId: tailoredResume.base_resume_uuid,
      userId: tailoredResume.user_id,
      jobDetails: {
        jobTitle: tailoredResume.job_title,
        company: tailoredResume.company,
        description: tailoredResume.job_description
      },
      tailoredData: JSON.parse(tailoredResume.tailored_data),
      createdAt: tailoredResume.created_at,
      updatedAt: tailoredResume.updated_at
    };
  }

  static async findByBaseResumeId(baseResumeUuid, userId = null) {
    // Get the internal ID first
    let baseResumeQuery = `SELECT id FROM base_resumes WHERE uuid = ?`;
    let baseResumeParams = [baseResumeUuid];
    
    if (userId) {
      baseResumeQuery += ` AND user_id = ?`;
      baseResumeParams.push(userId);
    }
    
    const baseResume = await database.get(baseResumeQuery, baseResumeParams);

    if (!baseResume) return [];

    const tailoredResumes = await database.all(`
      SELECT tr.*, br.uuid as base_resume_uuid, br.user_id as user_id
      FROM tailored_resumes tr
      JOIN base_resumes br ON tr.base_resume_id = br.id
      WHERE tr.base_resume_id = ?
      ORDER BY tr.created_at DESC
    `, [baseResume.id]);

    return tailoredResumes.map(tr => ({
      id: tr.uuid,
      baseResumeId: tr.base_resume_uuid,
      userId: tr.user_id,
      jobDetails: {
        jobTitle: tr.job_title,
        company: tr.company,
        description: tr.job_description
      },
      tailoredData: JSON.parse(tr.tailored_data),
      createdAt: tr.created_at,
      updatedAt: tr.updated_at
    }));
  }

  static async findAll(userId = null) {
    let query = `
      SELECT tr.*, br.uuid as base_resume_uuid, br.user_id as user_id
      FROM tailored_resumes tr
      JOIN base_resumes br ON tr.base_resume_id = br.id
    `;
    let params = [];
    
    if (userId) {
      query += ` WHERE br.user_id = ?`;
      params.push(userId);
    }
    
    query += ` ORDER BY tr.created_at DESC`;
    
    const tailoredResumes = await database.all(query, params);

    return tailoredResumes.map(tr => ({
      id: tr.uuid,
      baseResumeId: tr.base_resume_uuid,
      userId: tr.user_id,
      jobDetails: {
        jobTitle: tr.job_title,
        company: tr.company,
        description: tr.job_description
      },
      tailoredData: JSON.parse(tr.tailored_data),
      createdAt: tr.created_at,
      updatedAt: tr.updated_at
    }));
  }

  static async update(uuid, updateData) {
    const updates = [];
    const values = [];

    if (updateData.jobDetails) {
      if (updateData.jobDetails.jobTitle) {
        updates.push('job_title = ?');
        values.push(updateData.jobDetails.jobTitle);
      }
      if (updateData.jobDetails.company) {
        updates.push('company = ?');
        values.push(updateData.jobDetails.company);
      }
      if (updateData.jobDetails.description) {
        updates.push('job_description = ?');
        values.push(updateData.jobDetails.description);
      }
    }

    if (updateData.tailoredData) {
      updates.push('tailored_data = ?');
      values.push(JSON.stringify(updateData.tailoredData));
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(uuid);

    await database.run(`
      UPDATE tailored_resumes SET ${updates.join(', ')} WHERE uuid = ?
    `, values);

    return await TailoredResume.findByUuid(uuid);
  }

  static async delete(uuid) {
    const result = await database.run(`
      DELETE FROM tailored_resumes WHERE uuid = ?
    `, [uuid]);

    return result.changes > 0;
  }

  static async verifyBaseResumeOwnership(baseResumeUuid, userId) {
    const baseResume = await database.get(`
      SELECT id FROM base_resumes WHERE uuid = ? AND user_id = ?
    `, [baseResumeUuid, userId]);

    return !!baseResume;
  }
}

export default TailoredResume;