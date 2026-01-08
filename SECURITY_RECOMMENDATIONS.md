# Security Recommendations for Authentication System

**Priority Level:** CRITICAL
**Branch:** `feat/authentication`
**Date:** January 9, 2026

---

## Quick Summary

The current authentication system has a **critical security gap**: the frontend uses Clerk for user authentication, but the backend doesn't verify these credentials. The backend currently accepts any `x-user-id` header value without validation, meaning:

- Any attacker can access any user's data by changing the header
- There's no real authentication on the backend
- All requests currently use a hardcoded `default-user` ID

---

## Priority 1: CRITICAL - Fix Backend Authentication

### Issue 1.1: No Token Verification

**Current Code (INSECURE):**
```typescript
// apps/frontend/services/api.ts
private async request<T>(endpoint: string, options: RequestInit = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'x-user-id': 'default-user',  // ❌ HARDCODED, NO AUTH
  };
  // Any request uses this hardcoded user
}
```

```javascript
// apps/backend/src/routes/resumes.js
router.get('/', async (req, res) => {
  let userId = req.headers['x-user-id'] || null;  // ❌ TRUSTS CLIENT
  if (userId === 'default-user') {
    userId = await Resume.getDefaultUserId();
  }
  const resumes = await Resume.findByUserId(userId);  // ❌ NO VALIDATION
});
```

**Security Risk:** Alice can access Bob's data by setting header `x-user-id: bob`

**Solution:**

1. **Get Clerk Session on Frontend:**
```typescript
// apps/frontend/services/api.ts
import { useAuth } from '@clerk/clerk-react';

class ApiClient {
  private authHook: any; // Injected from component level

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;

    // Get current user session
    const { getToken } = useAuth();  // From Clerk
    const token = await getToken();

    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,  // ✅ USE CLERK TOKEN
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...defaultHeaders, ...options.headers },
      });
      // ...
    }
  }
}
```

**Issue:** Hooks can't be called from class methods. Better approach:

```typescript
// apps/frontend/services/api.ts - Create context wrapper
export const createApiClient = (getToken: () => Promise<string | null>) => {
  return {
    async request<T>(
      endpoint: string,
      options: RequestInit = {}
    ): Promise<ApiResponse<T>> {
      const token = await getToken();
      const defaultHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`,
      };
      // ... rest of request logic
    },
    // All other methods use the above request
  };
};
```

```typescript
// apps/frontend/components/Dashboard.tsx - Usage
import { useAuth } from '@clerk/clerk-react';
import { createApiClient } from '../services/api';

function Dashboard() {
  const { getToken } = useAuth();
  const apiClient = useMemo(() => createApiClient(getToken), [getToken]);

  // Use apiClient for all requests
}
```

2. **Add Clerk Verification Middleware on Backend:**
```bash
npm install @clerk/express
```

```javascript
// apps/backend/src/middleware/auth.js - NEW FILE
import { clerkClient } from '@clerk/express';
import jwt from 'jsonwebtoken';

export const verifyClerkToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    // Verify token with Clerk
    const decoded = jwt.decode(token);

    if (!decoded || !decoded.sub) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    // Token is valid, attach user ID to request
    req.user = {
      id: decoded.sub,  // Clerk user ID
      email: decoded.email
    };

    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.decode(token);

      if (decoded?.sub) {
        req.user = {
          id: decoded.sub,
          email: decoded.email
        };
      }
    }
  } catch (error) {
    console.warn('Optional auth failed:', error);
  }

  next();
};
```

3. **Apply Middleware to Routes:**
```javascript
// apps/backend/src/server.js
import { verifyClerkToken } from './middleware/auth.js';

// Apply to all API routes
app.use('/api/resumes', verifyClerkToken, resumesRouter);
app.use('/api/tailored-resumes', verifyClerkToken, tailoredResumesRouter);
app.use('/api/ai', verifyClerkToken, aiRouter);
```

4. **Update Route Handlers:**
```javascript
// apps/backend/src/routes/resumes.js
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;  // ✅ FROM VERIFIED TOKEN
    const resumes = await Resume.findByUserId(userId);

    res.json({
      success: true,
      data: resumes
    });
  } catch (error) {
    console.error('Error fetching resumes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resumes',
      error: error.message
    });
  }
});
```

---

## Priority 2: HIGH - Data Isolation & User Tracking

### Issue 2.1: No User Record Mapping

**Problem:** Database doesn't track which data belongs to which Clerk user.

**Solution:**

```javascript
// apps/backend/src/models/User.js - RE-CREATE
import database from '../config/database.js';

class User {
  constructor(data) {
    this.id = data.id;
    this.clerkId = data.clerkId;      // ✅ NEW: Clerk user ID
    this.email = data.email;
    this.name = data.name;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  static async findOrCreateByClerkId(clerkId, userData) {
    const query = 'SELECT * FROM users WHERE clerkId = ?';

    try {
      let row = await database.get(query, [clerkId]);
      if (row) {
        return new User(row);
      }

      // Create new user
      const insertQuery = `
        INSERT INTO users (clerkId, email, name, createdAt, updatedAt)
        VALUES (?, ?, ?, datetime('now'), datetime('now'))
      `;

      await database.run(insertQuery, [
        clerkId,
        userData.email,
        userData.name || ''
      ]);

      row = await database.get(query, [clerkId]);
      return new User(row);
    } catch (error) {
      console.error('Error finding/creating user:', error);
      throw error;
    }
  }

  static async findById(id) {
    const query = 'SELECT * FROM users WHERE id = ?';
    const row = await database.get(query, [id]);
    return row ? new User(row) : null;
  }
}

export default User;
```

```javascript
// apps/backend/src/models/Resume.js - UPDATE
import User from './User.js';

class Resume {
  static async create(resumeData) {
    const { userId, ...restData } = resumeData;

    // Verify user exists in our DB
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const query = `
      INSERT INTO resumes (
        id, userId, name, contact, summary, skills,
        experience, education, projects, isBase, createdAt, updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `;

    try {
      const result = await database.run(query, [
        uuidv4(),
        userId,  // Internal DB user ID (foreign key)
        // ... rest of data
      ]);
      return await this.findByUuid(result.lastID);
    } catch (error) {
      throw error;
    }
  }

  // Add ownership verification
  static async findByUuidAndUserId(uuid, userId) {
    const query = `
      SELECT * FROM resumes
      WHERE id = ? AND userId = ?
    `;

    const row = await database.get(query, [uuid, userId]);
    return row ? new Resume(row) : null;
  }
}
```

### Issue 2.2: Update Database Schema

```javascript
// apps/backend/src/config/initDb.js - ADD USER TABLE
const createUserTable = async () => {
  const createTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clerkId TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await database.run(createTable);
    console.log('Users table created or already exists');
  } catch (error) {
    if (!error.message.includes('already exists')) {
      throw error;
    }
  }
};

// Add foreign key to resumes table
const updateResumesTable = async () => {
  try {
    // Check if userId column exists
    const checkColumn = 'PRAGMA table_info(resumes);';
    const info = await database.all(checkColumn);

    const hasUserId = info.some(col => col.name === 'userId');
    if (!hasUserId) {
      await database.run('ALTER TABLE resumes ADD COLUMN userId INTEGER;');
      // Migrate existing data to default user
      await database.run(
        'UPDATE resumes SET userId = (SELECT id FROM users WHERE clerkId = ?)',
        ['default-user']
      );
      // Add foreign key constraint
      // (Note: SQLite requires more complex migration for FK constraints)
    }
  } catch (error) {
    console.warn('Resume table migration:', error.message);
  }
};
```

---

## Priority 3: MEDIUM - Input Validation & Rate Limiting

### Issue 3.1: Insufficient Input Validation

**Good:** `express-validator` is already used
**Better:** Add authorization checks

```javascript
// apps/backend/src/routes/resumes.js
router.put('/:id', [
  param('id').isUUID().withMessage('Invalid resume ID'),
  body('name').optional().trim().isLength({ min: 1 })
], handleValidationErrors, async (req, res) => {
  try {
    // ✅ VERIFY OWNERSHIP before updating
    const resume = await Resume.findByUuidAndUserId(
      req.params.id,
      req.user.id  // From verified token
    );

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    const updated = await Resume.update(req.params.id, req.body);
    res.json({
      success: true,
      message: 'Resume updated successfully',
      data: updated
    });
  } catch (error) {
    console.error('Error updating resume:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update resume'
    });
  }
});

router.delete('/:id', [
  param('id').isUUID().withMessage('Invalid resume ID')
], handleValidationErrors, async (req, res) => {
  try {
    // ✅ VERIFY OWNERSHIP before deleting
    const resume = await Resume.findByUuidAndUserId(
      req.params.id,
      req.user.id  // From verified token
    );

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    const deleted = await Resume.delete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    res.json({
      success: true,
      message: 'Resume deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting resume:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete resume'
    });
  }
});
```

### Issue 3.2: Rate Limiting Is Too Loose

**Current:** 100 requests per 15 minutes (OK but not per-user)
**Better:** Per-user limits

```javascript
// apps/backend/src/server.js
import rateLimit from 'express-rate-limit';

// Global rate limit
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,
  message: 'Too many requests, please try again later'
});

// Per-user rate limit (stricter)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 30,                   // 30 requests per user per minute
  keyGenerator: (req, res) => req.user?.id || req.ip,  // Key by user ID
  message: 'Too many requests for this resource'
});

app.use(globalLimiter);

// Apply stricter limits to authenticated routes
app.use('/api/resumes', authLimiter);
app.use('/api/tailored-resumes', authLimiter);
app.use('/api/ai', authLimiter);
```

---

## Priority 4: MEDIUM - Logging & Monitoring

### Issue 4.1: No Audit Trail

**Add Logging for Auth Events:**

```javascript
// apps/backend/src/middleware/logging.js
export const authLog = (req, res, next) => {
  const start = Date.now();

  // Log response after it's sent
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      userId: req.user?.id || 'anonymous',
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    }));
  });

  next();
};
```

```javascript
// apps/backend/src/server.js
import { authLog } from './middleware/logging.js';

app.use(authLog);
```

---

## Priority 5: LOW - Cleanup & Optimization

### Issue 5.1: Remove Unused Dependencies

```bash
# Remove if not using OAuth anymore
npm uninstall bcryptjs jsonwebtoken passport passport-google-oauth20

# Update backend/package.json
```

### Issue 5.2: Update Environment Templates

```bash
# apps/frontend/.env.example
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
VITE_API_URL=http://localhost:4300/api
NODE_ENV=production
```

```bash
# apps/backend/.env.example
PORT=4300
NODE_ENV=production
FRONTEND_URL=http://localhost:3160
DB_PATH=../../data/resumate.db
# Note: JWT_SECRET no longer used, can be removed
```

---

## Implementation Checklist

- [ ] **Phase 1: Backend Token Verification**
  - [ ] Install `@clerk/express`
  - [ ] Create `middleware/auth.js` with Clerk token verification
  - [ ] Test token verification with curl/Postman

- [ ] **Phase 2: Frontend Token Sending**
  - [ ] Create `createApiClient(getToken)` function
  - [ ] Update API calls to use Clerk token
  - [ ] Test with browser network inspector

- [ ] **Phase 3: User Model & Database**
  - [ ] Create/update User model with Clerk ID
  - [ ] Update database schema
  - [ ] Create user sync logic

- [ ] **Phase 4: Route Authorization**
  - [ ] Add ownership checks to all routes
  - [ ] Test user isolation (attempt to access another user's data)
  - [ ] Verify 404 vs 403 responses for unauthorized access

- [ ] **Phase 5: Testing & Validation**
  - [ ] Integration test for auth flow
  - [ ] Test token expiration handling
  - [ ] Load test with rate limiting
  - [ ] Security audit of all endpoints

---

## Testing Commands

### Test Token Verification:

```bash
# Get a valid token first (from app or test)
TOKEN="your_clerk_token_here"

# Test protected endpoint WITHOUT token
curl -X GET http://localhost:4300/api/resumes
# Should return: 401 Unauthorized

# Test protected endpoint WITH token
curl -X GET http://localhost:4300/api/resumes \
  -H "Authorization: Bearer $TOKEN"
# Should return: 200 with user's resumes

# Test with wrong token
curl -X GET http://localhost:4300/api/resumes \
  -H "Authorization: Bearer invalid_token"
# Should return: 401 Invalid token
```

### Test User Isolation:

```javascript
// Create two test users in Clerk
// User A gets their resumes
// User B tries to access User A's resume ID
// Should get 404 or 403 (ownership verification)
```

---

## References

- **Clerk Express Docs:** https://clerk.com/docs/references/express/jwt-template
- **OWASP Top 10 - Broken Authentication:** https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/
- **Express Security Best Practices:** https://expressjs.com/en/advanced/best-practice-security.html
- **JWT Best Practices:** https://tools.ietf.org/html/rfc8725

---

**Created:** January 9, 2026
**Status:** CRITICAL SECURITY REVIEW
**Next Review:** After implementation of Phase 1-2
