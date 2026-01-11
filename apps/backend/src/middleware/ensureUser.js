import database from "../config/database.js";

/**
 * Middleware to ensure user exists in database
 * Auto-creates user if they don't exist (for Clerk integration)
 */
export const ensureUserExists = async (req, res, next) => {
  try {
    const userId = req.headers["x-user-id"];

    if (!userId) {
      return next();
    }

    // Check if user exists by uuid
    const existingUser = await database.get(
      "SELECT id FROM users WHERE uuid = ?",
      [userId]
    );

    if (!existingUser) {
      // Auto-create user
      await database.run(
        "INSERT INTO users (uuid, email, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))",
        [userId, `${userId}@clerk.user`]
      );
      console.log(`Auto-created user: ${userId}`);
    }

    next();
  } catch (error) {
    console.error("Error in ensureUserExists middleware:", error);
    next(error);
  }
};
