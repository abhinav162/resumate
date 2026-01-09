# RESUMATE DESIGN SYSTEM - QUICK START GUIDE

**Ready to start?** Follow these steps to begin the UI revamp.

---

## ⚡ Getting Started (15 minutes)

### Step 1: Review Documents

1. **Read DESIGN_SYSTEM.md** (10 min) - Understand the design direction
2. **Skim IMPLEMENTATION_WORKFLOW.md** (5 min) - See the roadmap

### Step 2: Set Up Your Environment

```bash
cd /Users/apple/Desktop/den/resumate/apps/frontend

# Make sure dependencies are installed
npm install

# Start dev server
npm run dev
```

### Step 3: Start Phase 0

Open `IMPLEMENTATION_WORKFLOW.md` and follow **Phase 0: Foundation Setup**

---

## 📝 How to Track Progress

1. Open `IMPLEMENTATION_WORKFLOW.md`
2. As you complete tasks, change:
   - `⏸️` (Not Started) → `✅` (Completed)
3. Use checkpoints to verify each step
4. Commit to git after each phase

Example:
```markdown
### Tasks

#### Task 0.1: Install Dependencies ✅  <-- Change this

```bash
npm install @fontsource/jetbrains-mono
```

**Checkpoint:** Verify in `package.json`  <-- Verify here
```

---

## 🎯 Recommended Workflow

### Option 1: Weekend Sprint (Recommended)
- **Day 1 (Saturday):** Phases 0-2 (Setup + Core Components) - 6 hours
- **Day 2 (Sunday):** Phases 3-4 (More Components + Match Score) - 7 hours
- **Next Weekend:** Phases 5-8 (Page Revamps) - 22 hours
- **Final Weekend:** Phases 9-10 (Testing + Polish) - 7 hours

### Option 2: Weeknight Progress
- **Week 1 (Mon-Fri):** Phase 0-1 (1 hour/night)
- **Week 2 (Mon-Fri):** Phase 2-3 (1 hour/night)
- **Week 3 (Mon-Fri):** Phase 4-5 (1-2 hours/night)
- **Week 4 (Mon-Fri):** Phase 6-8 (1-2 hours/night)
- **Week 5 (Mon-Fri):** Phase 9-10 (1 hour/night)

### Option 3: One Phase at a Time
- Complete one phase whenever you have time
- Each phase is 2-6 hours
- Can pause/resume anytime
- Commit after each phase

---

## 🔥 First 30 Minutes Checklist

Follow these steps to see immediate results:

```bash
# 1. Navigate to frontend
cd /Users/apple/Desktop/den/resumate/apps/frontend

# 2. Install fonts (if not already)
npm install @fontsource/jetbrains-mono

# 3. Open index.html
code index.html
```

Add these lines in `<head>`:
```html
<link rel="preconnect" href="https://api.fontshare.com">
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@500,700,900&f[]=general-sans@400,500,600&display=swap" rel="stylesheet">
```

```bash
# 4. Create design tokens
mkdir -p src/styles
code src/styles/design-tokens.css
```

Copy the tokens from `IMPLEMENTATION_WORKFLOW.md` Phase 1, Task 1.1

```bash
# 5. Update index.css
code index.css
```

Copy the global styles from `IMPLEMENTATION_WORKFLOW.md` Phase 1, Task 1.2

```bash
# 6. Start dev server
npm run dev
```

**Result:** You should now see new fonts (Satoshi/General Sans) and the warm amber color scheme!

---

## 🧩 Component Build Order

Build components in this order for best results:

1. ✅ **Button** - Most used component
2. ✅ **Input/Textarea** - Form foundations
3. ✅ **Card** - Container component
4. ✅ **Badge** - Status indicators
5. ✅ **Spinner** - Loading states
6. ✅ **MatchScore** - Signature component

Then use these components to rebuild pages:
7. Landing Page
8. Dashboard
9. Profile Manager
10. Tailor Page

---

## 🐛 Troubleshooting

### Fonts Not Loading
```bash
# Check Network tab in DevTools
# Look for requests to api.fontshare.com
# If blocked, check browser console for errors
```

### Tailwind Classes Not Working
```bash
# Restart dev server
npm run dev

# Clear browser cache
# Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
```

### Components Not Rendering
```typescript
// Make sure imports are correct
import { Button } from './components/common';  // ✅ Correct
import Button from './components/common/Button';  // ❌ Wrong
```

### TypeScript Errors
```bash
# If you see "Cannot find module" errors
npm install
npm run dev
```

---

## 📚 Reference

### Color Classes
```tsx
// Backgrounds
bg-bg-primary         // #0A0E14 - Main background
bg-bg-secondary       // #151922 - Cards
bg-bg-tertiary        // #1E2330 - Elevated

// Text
text-text-primary     // #E8E9ED - Main text
text-text-secondary   // #9CA3B4 - Secondary text
text-text-tertiary    // #6B7280 - Disabled

// Accents
bg-amber-400          // #FBBF24 - Primary actions
bg-emerald-500        // #10B981 - Success
bg-rose-500           // #F43F5E - Error
```

### Component Usage
```tsx
// Button
<Button variant="primary" size="lg">
  Click Me
</Button>

// Input
<Input
  label="Email"
  placeholder="you@example.com"
  error="Invalid email"
/>

// Card
<Card variant="elevated" padding="lg" hover>
  Content here
</Card>

// Match Score
<MatchScore score={94} size="md" animated showLabel />
```

---

## ✅ Phase 0 Quick Checklist

Before starting, complete Phase 0:

- [ ] Install `@fontsource/jetbrains-mono`
- [ ] Add font links to `index.html`
- [ ] Create `src/styles/` directory
- [ ] Create `src/components/common/` directory
- [ ] Backup current components
- [ ] Verify app still runs

**Time:** 30 minutes

Once complete, proceed to Phase 1!

---

## 🎨 Design Principles to Remember

As you build:

1. **Clarity Over Complexity** - Make things obvious
2. **Amber is Your Primary** - Use it for main actions
3. **Dark but Warm** - Not pure black, use slate
4. **Purposeful Animation** - Only animate with intention
5. **Content First** - Let resume content shine

---

## 🚀 Ready to Start?

1. Open `IMPLEMENTATION_WORKFLOW.md`
2. Start with **Phase 0: Foundation Setup**
3. Follow each task sequentially
4. Mark tasks as complete (⏸️ → ✅)
5. Test at each checkpoint
6. Commit after each phase

**First Command:**
```bash
cd /Users/apple/Desktop/den/resumate/apps/frontend
npm run dev
```

**Then open:** `IMPLEMENTATION_WORKFLOW.md` and begin Phase 0!

---

## 💡 Tips for Success

- ✅ **Do** test after each task
- ✅ **Do** commit frequently
- ✅ **Do** take breaks between phases
- ✅ **Do** ask for clarification if stuck
- ❌ **Don't** skip checkpoints
- ❌ **Don't** rush through phases
- ❌ **Don't** modify multiple files without testing

---

## 📞 Need Help?

**If you're stuck:**
1. Check the checkpoint - did you verify?
2. Look at console errors - what's the message?
3. Review the task instructions - did you miss a step?
4. Ask me to help debug!

**Resume from any point:**
Just open `IMPLEMENTATION_WORKFLOW.md` and find your last ✅ task!

---

Good luck with the revamp! 🎉

**Start here:** Phase 0 in `IMPLEMENTATION_WORKFLOW.md`
