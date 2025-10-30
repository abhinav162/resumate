import express from 'express';
import passport from '../config/passport.js';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

// Google OAuth login route
router.get('/google', 
  passport.authenticate('google', { 
    scope: ['profile', 'email'] 
  })
);

// Google OAuth callback route
router.get('/google/callback', 
  passport.authenticate('google', { 
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`,
    session: false
  }),
  async (req, res) => {
    try {
      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: req.user.id,
          email: req.user.email 
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3160';
      res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
    } catch (error) {
      console.error('Auth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=token_generation_failed`);
    }
  }
);

// Get current user route
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: user.toPublicJSON()
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user information'
    });
  }
});

// Update user profile route
router.put('/me', authenticateToken, async (req, res) => {
  try {
    const { name, email } = req.body;
    
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const updatedUser = await user.update({ name, email });

    res.json({
      success: true,
      user: updatedUser.toPublicJSON()
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user profile'
    });
  }
});

// Logout route
router.post('/logout', authenticateToken, (req, res) => {
  // Since we're using JWT, logout is handled client-side by removing the token
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Delete account route
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    const deleted = await User.delete(req.user.userId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account'
    });
  }
});

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
}

// Export the middleware for use in other routes
export { authenticateToken };

export default router;