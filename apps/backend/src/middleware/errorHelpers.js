import { validationResult } from 'express-validator';

/**
 * Shared validation error handler.
 * All routes should use this instead of defining their own.
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array(),
    });
  }
  next();
};
