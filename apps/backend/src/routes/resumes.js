import express from "express";
import { Resume } from "../models/Resume.js";
import { body, param } from "express-validator";
import database from "../config/database.js";
import { handleValidationErrors } from "../middleware/errorHelpers.js";

const router = express.Router();

// GET /api/resumes - Get all resumes
router.get("/", async (req, res) => {
  try {
    let userUuid = req.headers["x-user-id"] || null;

    // Handle default-user case by getting the default user ID
    if (userUuid === "default-user") {
      userUuid = await Resume.getDefaultUserId();
    }

    // Get userId from uuid
    const user = await database.get("SELECT id FROM users WHERE uuid = ?", [
      userUuid,
    ]);
    const userId = user ? user.id : null;

    const resumes = await Resume.findByUserId(userId);

    res.json({
      success: true,
      data: resumes,
    });
  } catch (error) {
    console.error("Error fetching resumes:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch resumes",
      error: error.message,
    });
  }
});

// GET /api/resumes/:id - Get specific resume
router.get(
  "/:id",
  [param("id").isUUID().withMessage("Invalid resume ID")],
  handleValidationErrors,
  async (req, res) => {
    try {
      const resume = await Resume.findByUuid(req.params.id);

      if (!resume) {
        return res.status(404).json({
          success: false,
          message: "Resume not found",
        });
      }

      res.json({
        success: true,
        data: resume,
      });
    } catch (error) {
      console.error("Error fetching resume:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch resume",
        error: error.message,
      });
    }
  }
);

// POST /api/resumes - Create new resume
router.post(
  "/",
  [
    body("name")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Resume name is required"),
    body("contact.name")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Contact name is required"),
    body("contact.email").isEmail().withMessage("Valid email is required"),
    body("contact.phone")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Phone number is required"),
    body("contact.location")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Location is required"),
    body("summary").optional().trim(),
    body("skills").isArray().withMessage("Skills must be an array"),
    body("experience").isArray().withMessage("Experience must be an array"),
    body("education").isArray().withMessage("Education must be an array"),
    body("projects")
      .optional()
      .isArray()
      .withMessage("Projects must be an array"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const userUuid = req.headers["x-user-id"] || null;

      // Get the integer user_id from the uuid
      let userId = null;
      if (userUuid) {
        const user = await database.get("SELECT id FROM users WHERE uuid = ?", [
          userUuid,
        ]);
        userId = user ? user.id : null;
      }

      const resumeData = {
        ...req.body,
        userId,
      };

      const resume = await Resume.create(resumeData);

      res.status(201).json({
        success: true,
        message: "Resume created successfully",
        data: resume,
      });
    } catch (error) {
      console.error("Error creating resume:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create resume",
        error: error.message,
      });
    }
  }
);

// PUT /api/resumes/:id - Update resume
router.put(
  "/:id",
  [
    param("id").isUUID().withMessage("Invalid resume ID"),
    body("name")
      .optional()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Resume name cannot be empty"),
    body("contact.name")
      .optional()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Contact name cannot be empty"),
    body("contact.email")
      .optional()
      .isEmail()
      .withMessage("Valid email is required"),
    body("contact.phone")
      .optional()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Phone number cannot be empty"),
    body("contact.location")
      .optional()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Location cannot be empty"),
    body("summary").optional().trim(),
    body("skills").optional().isArray().withMessage("Skills must be an array"),
    body("isBase")
      .optional()
      .isBoolean()
      .withMessage("isBase must be a boolean"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const resume = await Resume.update(req.params.id, req.body);

      if (!resume) {
        return res.status(404).json({
          success: false,
          message: "Resume not found",
        });
      }

      res.json({
        success: true,
        message: "Resume updated successfully",
        data: resume,
      });
    } catch (error) {
      console.error("Error updating resume:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update resume",
        error: error.message,
      });
    }
  }
);

// DELETE /api/resumes/:id - Delete resume
router.delete(
  "/:id",
  [param("id").isUUID().withMessage("Invalid resume ID")],
  handleValidationErrors,
  async (req, res) => {
    try {
      const deleted = await Resume.delete(req.params.id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: "Resume not found",
        });
      }

      res.json({
        success: true,
        message: "Resume deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting resume:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete resume",
        error: error.message,
      });
    }
  }
);

export default router;
