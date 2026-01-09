# Authentication & Authorization System Analysis
**Branch:** `feat/authentication`
**Last Updated:** January 9, 2026

---

## Executive Summary

The Resumate application implements a **Clerk-based authentication system** on the frontend with a **placeholder user identification approach** on the backend. The system has evolved through multiple authentication strategies:

1. **Original:** Custom Google OAuth + JWT-based authentication
2. **Current:** Clerk authentication (frontend) with basic user ID header passing (backend)
3. **Status:** Authentication layer in transition - Clerk handles all user management, but backend still uses a simplified user identification scheme

---

## Current Architecture

### Frontend Authentication (Clerk-based)

**Location:** `/Users/apple/Desktop/den/resumate/apps/frontend/`

#### Key Components & Files:

**1. ClerkProvider Setup** (`index.tsx`)
```typescript
// /apps/frontend/index.tsx
import { ClerkProvider } from '@clerk/clerk-react'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

root.render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
```
- **Environment Variable:** `VITE_CLERK_PUBLISHABLE_KEY`
- **SignOut Behavior:** Redirects users to home page (`/`)
- **Version:** `@clerk/clerk-react: ^5.57.0`

**2. Route-based Protection** (`App.tsx`)
```typescript
// Uses Clerk's SignedIn/SignedOut components
<Route path="/dashboard"
  element={
    <>
      <SignedIn>
        <AppProvider>
          <DashboardLayout />
        </AppProvider>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  }
>
```
- **Protected Routes:** `/dashboard` and all nested routes (`/dashboard/profiles`, `/dashboard/tailor/:resumeId`)
- **Public Routes:** `/` (Landing page)
- **Fallback:** Catch-all redirects to home

**3. Authentication UI** (`LandingPage.tsx`)
```typescript
<SignedIn>
  <Link to="/dashboard">Dashboard</Link>
  <UserButton />  // Built-in Clerk user menu
</SignedIn>

<SignedOut>
  <SignInButton mode="modal">Sign In</SignInButton>
  <SignInButton mode="modal">Get Started</SignInButton>
</SignedOut>
```
- Uses Clerk's pre-built UI components
- Modal sign-in flow
- User profile menu via `UserButton`

#### Configuration:
- **File:** `/apps/frontend/.env.example`
- **Required Env Vars:**
  - `VITE_CLERK_PUBLISHABLE_KEY` - Public key for Clerk integration
  - `VITE_API_URL` - Backend API endpoint (default: `http://localhost:4300/api`)

---

### Backend Implementation

**Location:** `/Users/apple/Desktop/den/resumate/apps/backend/`

#### Current Approach (Simplified User Identification):

**User Identification via Headers** (`routes/resumes.js`)
```javascript
// /apps/backend/src/routes/resumes.js
router.get('/', async (req, res) => {
  let userId = req.headers['x-user-id'] || null;

  // Handle default-user case
  if (userId === 'default-user') {
    userId = await Resume.getDefaultUserId();
  }

  const resumes = await Resume.findByUserId(userId);
  // ...
});
```
- **Header Field:** `x-user-id`
- **Default Value:** `'default-user'` (hardcoded in API client)
- **Issue:** No actual authentication validation; relies on client-side header

**API Client Configuration** (`services/api.ts`)
```typescript
// /apps/frontend/services/api.ts
private async request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'x-user-id': 'default-user', // For now, using a default user
  };
  // ...
}
```

#### Security Middleware in Place:

**1. Helmet (Security Headers)**
```javascript
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
```
- Sets security headers (X-Frame-Options, X-Content-Type-Options, etc.)

**2. CORS Configuration**
```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
```
- **Environment Variable:** `FRONTEND_URL`
- **Default:** `http://localhost:5173` (Vite dev server)

**3. Rate Limiting**
```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);
```

**4. Input Validation**
```javascript
// express-validator used in routes
router.post('/', [
  body('name').trim().isLength({ min: 1 }).withMessage('Resume name is required'),
  body('contact.email').isEmail().withMessage('Valid email is required'),
  // ... more validators
], handleValidationErrors, async (req, res) => {
  // handler
});
```

#### Dependencies:
```json
{
  "bcryptjs": "^2.4.3",          // Not currently used
  "jsonwebtoken": "^9.0.2",      // Not currently used
  "express-validator": "^7.0.1", // Input validation
  "helmet": "^7.1.0",             // Security headers
  "express-rate-limit": "^7.1.5", // Rate limiting
  "cors": "^2.8.5"                // CORS handling
}
```

---

## Historical Authentication Implementations

### 1. Google OAuth + JWT (Commit: `ba915f2`)

**Status:** Removed/Replaced
**Date:** October 30, 2025

#### Files That Existed:

**1. Passport Configuration** (`config/passport.js`)
```javascript
// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
  // Check/create user
  let user = await User.findByGoogleId(profile.id);
  if (!user) {
    user = await User.create({
      googleId: profile.id,
      email: profile.emails[0].value,
      name: profile.displayName,
      profilePicture: profile.photos[0]?.value
    });
  }
  return done(null, user);
}));
```

**2. Authentication Routes** (`routes/auth.js`)
```javascript
// Google OAuth endpoints
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  async (req, res) => {
    // Generate JWT token
    const token = jwt.sign(
      { userId: req.user.id, email: req.user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  }
);

router.get('/me', authenticateToken, async (req, res) => {
  // Get current user
});

router.put('/me', authenticateToken, async (req, res) => {
  // Update user profile
});

router.post('/logout', authenticateToken, (req, res) => {
  // Logout (client-side token removal)
});

router.delete('/account', authenticateToken, async (req, res) => {
  // Delete account
});
```

**3. JWT Middleware** (`middleware/auth.js`)
```javascript
export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = { ...decoded, userObj: user };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(403).json({ message: 'Invalid token' });
  }
};

export const optionalAuth = async (req, res, next) => {
  // Same as above but doesn't fail if token missing
};
```

**4. User Model** (`models/User.js`)
```javascript
class User {
  // Database fields:
  // - id (primary key)
  // - googleId
  // - email (unique)
  // - name
  // - profilePicture
  // - createdAt
  // - updatedAt

  static async findByGoogleId(googleId) { }
  static async findByEmail(email) { }
  async update(updateData) { }
  // ... other methods
}
```

**Environment Variables Needed:**
```
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=/api/auth/google/callback
JWT_SECRET=your_jwt_secret_here
```

### 2. Custom Frontend Auth Components (Commit: `1497ef3`)

**Status:** Removed/Replaced
**Date:** November 16, 2025

Files that existed but were removed:
- `contexts/AuthContext.tsx` - Custom auth state management
- `components/Login.tsx` - Custom login form
- `components/ProtectedRoute.tsx` - Custom route protection
- `types/auth.ts` - Auth type definitions

### 3. Clerk Authentication (Commit: `3368804`)

**Status:** Current Implementation
**Date:** November 26, 2025

Migration from custom/OAuth to Clerk-based auth:
- Removed custom auth components
- Added Clerk SDK integration
- Updated App.tsx to use Clerk components
- Simplified authentication to Clerk-managed system

---

## Security Vulnerabilities & Issues

### Critical Issues:

1. **No Real Backend Authentication** ⚠️
   - **Problem:** Backend uses `x-user-id` header from client without verification
   - **Impact:** Any client can impersonate any user by setting the header
   - **Risk Level:** CRITICAL
   - **Fix Needed:** Validate user from Clerk JWT token or implement proper token verification

2. **Missing Clerk Integration on Backend**
   - **Problem:** Backend doesn't verify Clerk tokens; relies only on client-provided header
   - **Impact:** Authentication is only enforced on frontend; backend has no validation
   - **Risk Level:** CRITICAL
   - **Fix Needed:** Add Clerk token verification middleware to backend

3. **Default User Fallback** ⚠️
   - **Problem:** If `x-user-id` is not provided, falls back to hardcoded `'default-user'`
   - **Impact:** All requests without proper header share the same data
   - **Risk Level:** HIGH
   - **Code Location:** `apps/backend/src/routes/resumes.js` line 26-28

### Medium Issues:

4. **Hardcoded x-user-id in API Client**
   - **Problem:** All API requests use `'default-user'` as the user ID
   - **Code:** `apps/frontend/services/api.ts` line 15
   - **Fix Needed:** Extract actual user ID from Clerk after authentication

5. **Missing User Model Updates**
   - **Problem:** User model removed but app doesn't track Clerk user IDs
   - **Impact:** Cannot correlate Clerk users to backend user records
   - **Fix Needed:** Store Clerk user IDs and map them to backend records

6. **No User Data Isolation**
   - **Problem:** Queries use `userId` but all requests use same default user
   - **Impact:** All data appears isolated in code but actually shared
   - **Risk Level:** MEDIUM

### Low Issues:

7. **Environment Variable Missing**
   - **Problem:** Clerk publishable key not documented in .env.example
   - **Location:** `apps/frontend/.env.example` (should include `VITE_CLERK_PUBLISHABLE_KEY`)

8. **JWT_SECRET Exposed in Example**
   - **Problem:** Backend `.env.example` shows placeholder JWT secret
   - **Risk Level:** LOW (just an example, but should be more explicit about security)

---

## Environment Variables

### Frontend (`/apps/frontend/.env.example`)
```
VITE_API_URL=http://localhost:4300/api
NODE_ENV=production
# Missing: VITE_CLERK_PUBLISHABLE_KEY
```

### Backend (`/apps/backend/.env.example`)
```
PORT=4300
NODE_ENV=production
FRONTEND_URL=http://localhost:3160
DB_PATH=../../data/resumate.db
JWT_SECRET=CHANGE_THIS_TO_A_SECURE_RANDOM_STRING_IN_PRODUCTION
CORS_ORIGIN=http://localhost:3160
```

### Root (`.env.example`)
```
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001
DATABASE_URL=./data/resumate.db
JWT_SECRET=your_jwt_secret_here_for_future_auth
CORS_ORIGIN=http://localhost:3000
```

---

## Data Flow Diagram

### Current Authentication Flow:

```
User Login
    ↓
[Clerk Modal] - Frontend Sign In
    ↓
Clerk Authentication Complete
    ↓
ClerkProvider updates context
    ↓
<SignedIn> component renders Dashboard
    ↓
API Requests with x-user-id header
    ↓
Backend Route Handler (no validation)
    ↓
Database Query using x-user-id
    ↓
Return Results
```

### What SHOULD happen:

```
User Login
    ↓
[Clerk Modal] - Frontend Sign In
    ↓
Clerk Authentication Complete
    ↓
Get Clerk Session Token
    ↓
Send token in Authorization header
    ↓
Backend validates token with Clerk
    ↓
Extract userId from verified token
    ↓
Verify user has database record
    ↓
Proceed with request
    ↓
Return user-specific results
```

---

## API Endpoints Security Status

### Current State:

| Endpoint | Authentication | User Isolation | Status |
|----------|----------------|-----------------|--------|
| `GET /api/resumes` | None (header-based) | Via x-user-id | Needs Fix |
| `POST /api/resumes` | None (header-based) | Via x-user-id | Needs Fix |
| `PUT /api/resumes/:id` | None | Via x-user-id | Needs Fix |
| `DELETE /api/resumes/:id` | None | Via x-user-id | Needs Fix |
| `GET /api/tailored-resumes` | None | Via x-user-id | Needs Fix |
| `POST /api/tailored-resumes` | None | Via x-user-id | Needs Fix |
| `GET /api/ai/parse-resume` | None | Via x-user-id | Needs Fix |
| `POST /api/ai/tailor-resume` | None | Via x-user-id | Needs Fix |

---

## Recommended Implementation Path

### Phase 1: Immediate (Critical)
1. **Add Clerk Token Verification Middleware**
   - Install: `@clerk/express`
   - Create middleware to verify Clerk JWT tokens
   - Apply to all protected routes

2. **Update API Client to Send Tokens**
   - Extract user ID from Clerk's `useAuth()` hook
   - Send as Bearer token in Authorization header
   - Remove hardcoded `x-user-id`

3. **Create User Mapping Layer**
   - Store mapping between Clerk user IDs and local DB users
   - Add user sync on first login

### Phase 2: Important (Within Sprint)
4. **Re-introduce User Model**
   - Store: Clerk ID, email, name, createdAt, updatedAt
   - Sync on Clerk webhook events

5. **Add User Identification Middleware**
   - Verify Clerk token before allowing request
   - Attach verified user to request object
   - Return 401 for invalid/missing tokens

6. **Update Route Handlers**
   - Extract userId from `req.user` instead of headers
   - Add ownership verification for sensitive operations

### Phase 3: Hardening (Next Week)
7. **Implement Audit Logging**
   - Log authentication events
   - Track data access by user

8. **Add Session Management**
   - Implement token refresh logic
   - Handle token expiration properly

9. **Database Constraints**
   - Add foreign key constraints for user records
   - Ensure data isolation at DB level

---

## Files Summary

### Authentication-Related Files:

**Frontend:**
- `/apps/frontend/index.tsx` - Clerk provider setup
- `/apps/frontend/App.tsx` - Route protection with Clerk components
- `/apps/frontend/components/LandingPage.tsx` - Auth UI (SignInButton, UserButton)
- `/apps/frontend/services/api.ts` - API client (needs token updates)
- `/apps/frontend/contexts/AppContext.tsx` - App state (not auth state)
- `/apps/frontend/package.json` - Contains `@clerk/clerk-react: ^5.57.0`

**Backend:**
- `/apps/backend/src/server.js` - Express setup, Helmet, CORS, rate limiting
- `/apps/backend/src/routes/resumes.js` - Uses x-user-id header
- `/apps/backend/src/routes/tailored-resumes.js` - Uses x-user-id header
- `/apps/backend/src/routes/ai.js` - May use x-user-id
- `/apps/backend/package.json` - Has JWT/bcrypt deps (unused)
- `/apps/backend/.env.example` - JWT_SECRET defined

**Config/Env:**
- `/apps/frontend/.env.example` - Missing VITE_CLERK_PUBLISHABLE_KEY
- `/apps/backend/.env.example` - Has JWT_SECRET
- `/root/.env.example` - Root-level config

### Historical Files (Removed):
- `apps/backend/src/middleware/auth.js` - JWT verification middleware (deleted)
- `apps/backend/src/config/passport.js` - Google OAuth config (deleted)
- `apps/backend/src/routes/auth.js` - OAuth routes (deleted)
- `apps/backend/src/models/User.js` - User database model (deleted)
- `apps/frontend/contexts/AuthContext.tsx` - Custom auth context (deleted)
- `apps/frontend/components/Login.tsx` - Login form (deleted)
- `apps/frontend/components/ProtectedRoute.tsx` - Route protection (deleted)
- `apps/frontend/types/auth.ts` - Auth types (deleted)

---

## Dependencies Reference

### Frontend
```json
"@clerk/clerk-react": "^5.57.0"      // Auth provider
"react-router-dom": "^7.9.6"          // Routing
"react": "^19.2.0"                    // UI framework
```

### Backend
```json
"jsonwebtoken": "^9.0.2"              // Not used (should be removed)
"bcryptjs": "^2.4.3"                  // Not used (should be removed)
"express": "^4.18.2"                  // Server
"express-validator": "^7.0.1"         // Input validation
"helmet": "^7.1.0"                    // Security headers
"express-rate-limit": "^7.1.5"        // Rate limiting
"cors": "^2.8.5"                      // CORS handling
"dotenv": "^16.3.1"                   // Env vars
"sqlite3": "^5.1.6"                   // Database
```

---

## Checklist for Completing Authentication

- [ ] Install `@clerk/express` in backend
- [ ] Create JWT verification middleware
- [ ] Update API client to extract user ID from Clerk
- [ ] Implement Bearer token sending in API requests
- [ ] Add user model to track Clerk users
- [ ] Create user sync logic (Clerk -> DB)
- [ ] Apply auth middleware to all protected routes
- [ ] Update route handlers to use verified user
- [ ] Test user isolation (ensure users can't access others' data)
- [ ] Add Clerk public key to `.env.example` files
- [ ] Document token refresh flow
- [ ] Setup Clerk webhooks for sync events
- [ ] Remove unused JWT/bcryptjs if not needed
- [ ] Add integration tests for auth flows
- [ ] Review and harden all endpoints

---

## References

- **Clerk Documentation:** https://clerk.com/docs
- **Express.js Best Practices:** https://expressjs.com/
- **OWASP Authentication Cheat Sheet:** https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- **Git Commits on this branch:**
  - `ba915f2` - Added oauth backend
  - `1497ef3` - FE for auth
  - `3368804` - added clerk authentication

---

*Analysis completed January 9, 2026 on branch `feat/authentication`*
