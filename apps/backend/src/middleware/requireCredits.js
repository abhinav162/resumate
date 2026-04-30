import { getCredits } from '../services/creditService.js';

/**
 * Middleware factory to require a minimum credit balance
 * Returns 402 Payment Required if insufficient balance
 * @param {number} amount - Minimum credits required
 * @returns {Function} Express middleware function
 */
export function requireCredits(amount) {
  return async (req, res, next) => {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    try {
      const balance = await getCredits(req.user.id);
      if (balance < amount) {
        return res.status(402).json({
          success: false,
          code: 'INSUFFICIENT_CREDITS',
          message: `This action requires ${amount} credit${amount > 1 ? 's' : ''}. You have ${balance}.`,
          required: amount,
          balance,
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
