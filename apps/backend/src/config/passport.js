import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';

// Configure Google OAuth strategy only if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback"
  }, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user already exists with this Google ID
    let user = await User.findByGoogleId(profile.id);
    
    if (user) {
      // User exists, return the user
      return done(null, user);
    }
    
    // Check if user exists with the same email
    user = await User.findByEmail(profile.emails[0].value);
    
    if (user) {
      // User exists with email but no Google ID, update their record
      user = await user.update({
        googleId: profile.id,
        name: profile.displayName,
        profilePicture: profile.photos[0]?.value
      });
      return done(null, user);
    }
    
    // Create new user
    user = await User.create({
      googleId: profile.id,
      email: profile.emails[0].value,
      name: profile.displayName,
      profilePicture: profile.photos[0]?.value
    });
    
    return done(null, user);
  } catch (error) {
    console.error('OAuth error:', error);
    return done(error, null);
  }
  }));
} else {
  console.warn('Google OAuth credentials not provided. OAuth authentication will not be available.');
}

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;