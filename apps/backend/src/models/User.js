import database from '../config/database.js';

class User {
  constructor(data) {
    this.id = data.id;
    this.googleId = data.googleId;
    this.email = data.email;
    this.name = data.name;
    this.profilePicture = data.profilePicture;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  static async create(userData) {
    const { googleId, email, name, profilePicture } = userData;
    
    const query = `
      INSERT INTO users (googleId, email, name, profilePicture, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `;
    
    try {
      const result = await database.run(query, [googleId, email, name, profilePicture]);
      return await User.findById(result.lastID);
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('Failed to create user');
    }
  }

  static async findById(id) {
    const query = 'SELECT * FROM users WHERE id = ?';
    
    try {
      const row = await database.get(query, [id]);
      return row ? new User(row) : null;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw new Error('Failed to find user');
    }
  }

  static async findByGoogleId(googleId) {
    const query = 'SELECT * FROM users WHERE googleId = ?';
    
    try {
      const row = await database.get(query, [googleId]);
      return row ? new User(row) : null;
    } catch (error) {
      console.error('Error finding user by Google ID:', error);
      throw new Error('Failed to find user');
    }
  }

  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = ?';
    
    try {
      const row = await database.get(query, [email]);
      return row ? new User(row) : null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw new Error('Failed to find user');
    }
  }

  async update(updateData) {
    const allowedFields = ['name', 'email', 'profilePicture'];
    const updates = [];
    const values = [];

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(updateData[key]);
      }
    });

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    updates.push('updatedAt = datetime(\'now\')');
    values.push(this.id);

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

    try {
      await database.run(query, values);
      return await User.findById(this.id);
    } catch (error) {
      console.error('Error updating user:', error);
      throw new Error('Failed to update user');
    }
  }

  static async delete(id) {
    const query = 'DELETE FROM users WHERE id = ?';
    
    try {
      const result = await database.run(query, [id]);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new Error('Failed to delete user');
    }
  }

  static async getAll() {
    const query = 'SELECT * FROM users ORDER BY createdAt DESC';
    
    try {
      const rows = await database.all(query);
      return rows.map(row => new User(row));
    } catch (error) {
      console.error('Error getting all users:', error);
      throw new Error('Failed to get users');
    }
  }

  toJSON() {
    return {
      id: this.id,
      googleId: this.googleId,
      email: this.email,
      name: this.name,
      profilePicture: this.profilePicture,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toPublicJSON() {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      profilePicture: this.profilePicture,
      createdAt: this.createdAt
    };
  }
}

export default User;