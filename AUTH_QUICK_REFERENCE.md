# Authentication System - Quick Reference Guide

**For:** Developers working on feat/authentication branch
**Updated:** January 9, 2026

---

## Current State at a Glance

```
┌─────────────────────────────────────────────────────────┐
│                  FRONTEND (Clerk)                       │
│  ✅ Authentication: WORKING (Clerk handles it)          │
│  ✅ UI: Complete (Sign In, User Button)                │
│  ❌ Token Sending: BROKEN (uses hardcoded x-user-id)   │
└─────────────────────────────────────────────────────────┘
                         ↓
                    (x-user-id header)
                         ↓
┌─────────────────────────────────────────────────────────┐
│                  BACKEND (NO VALIDATION)                │
│  ❌ Token Verification: MISSING                         │
│  ❌ User Model: MISSING (removed)                       │
│  ⚠️  All requests = same default-user                   │
│  ⚠️  No ownership checks                                │
└─────────────────────────────────────────────────────────┘
```

---

## Key Files Map

### Frontend Authentication
```
apps/frontend/
├── index.tsx                    ← ClerkProvider setup
├── App.tsx                      ← Route protection
├── components/LandingPage.tsx   ← Sign In UI
├── services/api.ts              ← ⚠️ HARDCODED USER ID HERE
├── contexts/AppContext.tsx      ← App data (not auth)
└── package.json                 ← @clerk/clerk-react
```

### Backend Middleware/Routes
```
apps/backend/
├── src/server.js               ← Express setup (needs auth middleware)
├── src/middleware/             ← ❌ EMPTY (needs auth.js)
├── src/routes/
│   ├── resumes.js              ← Uses x-user-id header
│   ├── tailored-resumes.js     ← Uses x-user-id header
│   └── ai.js                   ← May use x-user-id
├── src/models/
│   ├── Resume.js               ← Queries by userId
│   ├── TailoredResume.js       ← Queries by userId
│   └── User.js                 ← ❌ MISSING (needs recreation)
├── src/config/
│   └── initDb.js               ← Database init (needs User table)
└── package.json                ← Has unused jwt/bcryptjs
```

---

## The Problem Explained Simply

**What's Happening Now:**
```javascript
// Frontend
const headers = {
  'x-user-id': 'default-user'  // Everyone uses the same ID
};

// Backend
const userId = req.headers['x-user-id'];  // Trusts whatever client sends
const resumes = await Resume.findByUserId(userId);  // Gets data
```

**Attack Scenario:**
```
Alice opens her resumes, API sends: { 'x-user-id': 'alice' }
Backend returns Alice's resumes
___

Bob opens his resumes, API sends: { 'x-user-id': 'bob' }
But Bob's browser could do: { 'x-user-id': 'alice' }  ← Sees Alice's data!
```

---

## What Needs to Happen

### Step 1: Frontend - Get Real Token from Clerk
```typescript
// CURRENT (WRONG)
const defaultHeaders = {
  'x-user-id': 'default-user'
};

// NEEDED (CORRECT)
const { getToken } = useAuth();  // From Clerk
const token = await getToken();  // Get JWT
const defaultHeaders = {
  'Authorization': `Bearer ${token}`  // Send real token
};
```

### Step 2: Backend - Verify Token
```javascript
// CURRENT (WRONG)
router.get('/', async (req, res) => {
  const userId = req.headers['x-user-id'];  // Trust client ❌
});

// NEEDED (CORRECT)
router.get('/', verifyClerkToken, async (req, res) => {
  const userId = req.user.id;  // From verified token ✅
});
```

### Step 3: Backend - Check Ownership
```javascript
// CURRENT (WRONG)
const resume = await Resume.findByUuid(id);  // Get any resume

// NEEDED (CORRECT)
const resume = await Resume.findByUuidAndUserId(id, req.user.id);  // Only user's resume
```

---

## File Changes Needed

### 1. apps/frontend/services/api.ts
```diff
- 'x-user-id': 'default-user',
+ 'Authorization': `Bearer ${token}`,
```

### 2. apps/backend/src/middleware/auth.js
**NEW FILE** - Copy from SECURITY_RECOMMENDATIONS.md Phase 1

### 3. apps/backend/src/models/User.js
**NEW FILE** - Recreate to track Clerk users

### 4. apps/backend/src/config/initDb.js
**UPDATE** - Add users table creation

### 5. apps/backend/src/routes/resumes.js
```diff
- let userId = req.headers['x-user-id'];
+ const userId = req.user.id;  // From middleware

- await Resume.findByUuid(id)
+ await Resume.findByUuidAndUserId(id, userId)
```

### 6. apps/backend/src/routes/tailored-resumes.js
Same changes as resumes.js

### 7. apps/backend/src/server.js
```diff
+ import { verifyClerkToken } from './middleware/auth.js';
+ app.use('/api/resumes', verifyClerkToken, resumesRouter);
+ app.use('/api/tailored-resumes', verifyClerkToken, tailoredResumesRouter);
+ app.use('/api/ai', verifyClerkToken, aiRouter);
```

### 8. apps/backend/package.json
```diff
+ "@clerk/express": "^0.5.0"
```

### 9. apps/frontend/.env.example
```diff
+ VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key
```

---

## Testing Your Changes

### Test 1: Verify Backend Requires Token
```bash
# Should fail
curl http://localhost:4300/api/resumes

# Should work (with real token)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:4300/api/resumes
```

### Test 2: Verify User Isolation
```
1. Create resume as User A
2. Get resume ID (e.g., "123")
3. Login as User B
4. Try to access resume "123"
5. Should get 404 or 403 (NOT the resume)
```

### Test 3: Check Headers in Network Tab
```
1. Open DevTools → Network
2. Make API request
3. Look for: Authorization: Bearer eyJ...
4. Should NOT see x-user-id: default-user
```

---

## Common Issues & Solutions

### Issue: "Token is undefined"
**Cause:** Not calling `getToken()` or using hook outside component
**Solution:** Make sure `useAuth()` is inside a component, not in a class

### Issue: "verifyClerkToken is not defined"
**Cause:** Forgot to import or create middleware
**Solution:** Create `/apps/backend/src/middleware/auth.js` first

### Issue: "Cannot read property 'id' of undefined"
**Cause:** `req.user` doesn't exist (middleware not applied)
**Solution:** Check that middleware is applied BEFORE route handler

### Issue: "All endpoints return 401"
**Cause:** Token verification failing for all requests
**Solution:**
1. Check token is being sent: `Authorization: Bearer TOKEN`
2. Check token is valid: console.log(decoded)
3. Check JWT_SECRET or Clerk config

---

## Code Snippets Ready to Use

### Frontend API Client Update
```typescript
import { useAuth } from '@clerk/clerk-react';

export const useApiClient = () => {
  const { getToken } = useAuth();

  return useMemo(() => {
    return createApiClient(getToken);
  }, [getToken]);
};

// Usage in components:
function MyComponent() {
  const apiClient = useApiClient();
  // Now use apiClient.getResumes(), etc.
}
```

### Backend Auth Middleware
See SECURITY_RECOMMENDATIONS.md → Priority 1 → Issue 1.1 → Solution → Step 2

### Ownership Verification
See SECURITY_RECOMMENDATIONS.md → Priority 2 → Issue 2.1 → Solution → Step 4

---

## Implementation Order

1. **Create User Model** - So backend can track Clerk users
2. **Add Auth Middleware** - So backend validates tokens
3. **Update Routes** - So they verify ownership
4. **Update Frontend API** - So it sends real tokens
5. **Test Everything** - Verify user isolation works

**Estimated Time:** 2-3 hours for complete implementation

---

## Clerk Integration Docs

- **Token Structure:** https://clerk.com/docs/references/backend-api/jwt-structure
- **Express Guide:** https://clerk.com/docs/references/express/jwt-template
- **Environment Setup:** https://dashboard.clerk.com (your project)

---

## Quick Checklist

- [ ] Backend gets token from frontend
- [ ] Backend verifies token is valid
- [ ] Backend extracts user ID from token
- [ ] Backend stores Clerk user ID in database
- [ ] Backend checks user owns the resource before returning it
- [ ] Frontend sends Authorization header instead of x-user-id
- [ ] All tests pass for user isolation
- [ ] No hardcoded user IDs remain

---

**Remember:** This is a CRITICAL security issue. Don't merge without completing all checks above.

**Questions?** See AUTHENTICATION_SYSTEM_ANALYSIS.md for detailed information.
