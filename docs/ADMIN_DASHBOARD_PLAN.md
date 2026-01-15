# Admin Dashboard Architecture Plan

## Overview

Organization plans (School $199/mo, University $499/mo) require an admin dashboard for managing multiple teachers/professors under one subscription.

---

## User Roles

| Role | Description |
|------|-------------|
| **Student** | Free, joins classes, takes quizzes, can create 5/month |
| **Teacher** | Individual user, creates quizzes/classes (Free or Pro) |
| **Org Admin** | Manages organization subscription, invites teachers |
| **Org Teacher** | Teacher under organization plan, inherits org limits |

---

## Firestore Structure

### New Collections

```
organizations/
  {orgId}/
    name: "Springfield High School"
    plan: "school" | "university"
    stripeCustomerId: "cus_xxx"
    stripeSubscriptionId: "sub_xxx"
    adminUserId: "uid_xxx"
    emailDomain: "springfield.edu" (optional, for auto-join)
    createdAt: timestamp

    members/ (subcollection)
      {memberId}/
        userId: "uid_xxx"
        email: "teacher@springfield.edu"
        role: "admin" | "teacher"
        joinedAt: timestamp
        status: "active" | "pending" | "removed"
```

### Updated User Data

```
userData/
  quizforge-account-{uid}/
    ...existing fields...
    organizations: [  // NEW - array for multiple orgs
      {
        orgId: "org123",
        role: "admin" | "teacher",
        joinedAt: timestamp
      }
    ]
```

### Invite Links Collection

```
orgInvites/
  {inviteCode}/  // e.g., "abc123" (short, shareable)
    orgId: "org123"
    orgName: "Springfield High School"
    createdAt: timestamp
    createdBy: "adminUserId"
    usesCount: 0  // track how many joined via this link
```

---

## Admin Dashboard Features

### Phase 1: Core Management
- [ ] Create organization on School/University purchase
- [ ] Admin dashboard view (separate from teacher dashboard)
- [ ] Invite teachers via email
- [ ] View all organization members
- [ ] Remove teachers from organization
- [ ] View organization-wide usage stats

### Phase 2: Domain-Based Access
- [ ] Set email domain for organization (e.g., @school.edu)
- [ ] Auto-join: teachers with matching email domain auto-join org
- [ ] Pending approval flow for domain joins

### Phase 3: Analytics & Reporting
- [ ] Total quizzes created across org
- [ ] Per-teacher usage breakdown
- [ ] Student engagement metrics
- [ ] Export reports (CSV)

### Phase 4: Advanced Features
- [ ] Invoice billing (for University plan)
- [ ] Custom branding (logo, colors)
- [ ] SSO integration (SAML/OAuth)
- [ ] API access

---

## User Flows

### Flow 1: Admin Purchases Organization Plan

1. User clicks "School" or "University" plan
2. Stripe checkout completes
3. Webhook creates organization document
4. User becomes org admin
5. Redirect to admin dashboard

### Flow 2: Teacher Joins via Link

1. Admin copies org invite link from dashboard
2. Admin shares link (email, Slack, in person, etc.)
3. Teacher clicks link → redirected to QuizForge
4. If not logged in → sign up/log in flow
5. After auth → auto-joined to organization
6. Teacher sees "You've joined [Org Name]!" confirmation
7. Teacher inherits organization plan limits

### Flow 3: Domain Auto-Join

1. Admin sets email domain (@school.edu)
2. New user signs up with matching email
3. System prompts: "Join Springfield High School?"
4. User confirms, joins organization
5. Teacher inherits organization plan limits

### Flow 4: Teacher Under Organization

1. Teacher logs in
2. System checks organizationId
3. If org exists, apply org plan limits
4. Show "Part of [Org Name]" badge
5. Hide upgrade prompts (already covered)

---

## UI Components Needed

### Admin Dashboard Page
```
/dashboard (existing) → teacher view
/admin → organization admin view (NEW)
```

### Admin Dashboard Sections
1. **Overview**: Member count, usage stats, plan info
2. **Members**: List, invite, remove teachers
3. **Usage**: Per-teacher breakdown, charts
4. **Settings**: Domain, billing, organization name
5. **Billing**: Stripe portal link, invoices

### Teacher View Changes
- Show org badge if part of organization
- Hide upgrade prompts if org covers them
- Show "Contact your admin" for limit increases

---

## Implementation Order

### Step 1: Data Model (Firestore)
- Create organizations collection
- Add organizationId to user accounts
- Update security rules

### Step 2: Organization Creation
- Create org on Stripe webhook (checkout.completed)
- Link admin user to organization
- Store subscription details

### Step 3: Admin Dashboard UI
- New admin view in QuizForge.jsx
- Members list with invite form
- Basic usage stats

### Step 4: Invite Link System
- Generate shareable org link (e.g., `/join/abc123`)
- Handle join page that auto-joins after auth
- No emails needed - admin shares link however they want

### Step 5: Limit Enforcement
- Check user's org membership
- Apply org plan limits if member
- Track per-user usage within org

### Step 6: Domain Auto-Join
- Domain configuration UI
- Auto-join prompt on signup
- Approval workflow

---

## Limit Logic (Option B - Simple)

**Org membership overrides personal plan.**

### How it works:
- If in ANY org → use that org's limits
- If in multiple orgs → use the BEST limit (highest)
- If in NO org → use personal plan (Free or Pro)
- Personal plan is only relevant when not in any org

### Example:
```
Teacher Jane in Springfield High (School plan):
- Her personal "Free" plan is ignored
- Uses org limits: 25 quizzes/mo, 3 classes, 50 students
- All her usage counts toward Springfield's stats

If Jane leaves Springfield:
- Back to personal Free: 5 quizzes/mo, 1 class, 30 students
```

### Multiple orgs (rare case):
```
Teacher Jane in both Springfield (25/mo) and Lincoln (35/mo):
- Uses BEST limit: 35 quizzes/month
- Usage tracked per-org for admin reporting
- No confusing dropdowns - just works
```

### Benefits:
- No "which account?" confusion for teachers
- Simpler UI - no org selector dropdown needed
- Clear value prop: join org = get better limits
- Admin sees all teacher usage in one place

---

## Security Considerations

- Only org admins can invite/remove members
- Teachers can leave organization (downgrade to free)
- Admins cannot access teacher's quiz content
- Usage data is aggregated, not individual quiz details
- Stripe webhook must verify organization ownership

---

## Estimated Complexity

| Component | Effort |
|-----------|--------|
| Firestore structure | Low |
| Organization creation | Medium |
| Admin dashboard UI | High |
| Invite system | Medium |
| Limit enforcement | Medium |
| Domain auto-join | Medium |
| **Total** | ~2-3 weeks focused work |

---

## Decisions Made

1. **Can teachers be in multiple organizations?**
   - **YES** - Teachers (e.g., adjuncts) may work at multiple schools
   - Uses BEST limit from all orgs (no per-org context needed)

2. **What happens when org subscription ends?**
   - **YES** - All teachers downgrade to Free

3. **Can admin see teacher's quizzes?**
   - **NO** - Only aggregated stats (privacy)

4. **Can teachers leave organization voluntarily?**
   - **YES** - They become Free users

5. **Invite system - KEEP IT SIMPLE**
   - One shareable link per organization (no individual invites)
   - Link: `quizforgeapp.com/join/abc123`
   - Teacher clicks → signs up/logs in → auto-joins
   - No codes to type, no extra steps

---

*Created: January 15, 2026*
