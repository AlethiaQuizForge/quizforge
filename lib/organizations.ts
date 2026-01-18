// Organization management for School/University plans
// This module handles organization creation, membership, and invite links

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  Timestamp,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';

// =============================================================================
// Types
// =============================================================================

export type OrgPlanId = 'school' | 'university';

export interface OrgLimits {
  teachers: number;
  quizzesPerTeacher: number;
  classesPerTeacher: number;
  studentsPerClass: number;
}

export interface Organization {
  id: string;
  name: string;
  plan: OrgPlanId;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  adminUserId: string;
  adminEmail: string;
  emailDomain: string | null; // Optional: for auto-join (e.g., "@school.edu")
  inviteCode: string; // Short code for invite link (e.g., "abc123")
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface OrgMember {
  id: string; // Same as userId for simplicity
  orgId: string;
  userId: string;
  email: string;
  displayName: string;
  role: 'admin' | 'teacher';
  joinedAt: Timestamp;
  status: 'active' | 'pending' | 'removed';
}

export interface UserOrgMembership {
  orgId: string;
  orgName: string;
  role: 'admin' | 'teacher';
  joinedAt: Timestamp;
}

// Extended user data with organization membership
export interface UserDataWithOrgs {
  name: string;
  email: string;
  role: 'teacher' | 'student' | 'creator';
  createdAt: string;
  plan?: 'free' | 'pro';
  organizations?: UserOrgMembership[]; // NEW: array of org memberships
}

// =============================================================================
// Plan Definitions (for organization plans)
// =============================================================================

export const ORG_PLANS: Record<OrgPlanId, {
  name: string;
  price: number;
  limits: OrgLimits;
  features: string[];
}> = {
  school: {
    name: 'School',
    price: 199,
    limits: {
      teachers: 25,
      quizzesPerTeacher: 25,
      classesPerTeacher: 3,
      studentsPerClass: 50,
    },
    features: [
      '25 teachers',
      '25 quizzes per teacher/month',
      '3 classes per teacher, 50 students each',
      'Admin dashboard',
      'Organization-wide analytics',
    ],
  },
  university: {
    name: 'University',
    price: 499,
    limits: {
      teachers: 50,
      quizzesPerTeacher: 35,
      classesPerTeacher: 10,
      studentsPerClass: 100,
    },
    features: [
      '50 professors',
      '35 quizzes per professor/month',
      '10 classes per professor, 100 students each',
      'Admin dashboard',
      'Organization-wide analytics',
      'Invoice billing',
    ],
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a short, unique invite code for an organization
 */
export function generateInviteCode(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // Removed confusing chars (i, l, o, 0, 1)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Get organization limits for a given plan
 */
export function getOrgLimits(plan: OrgPlanId): OrgLimits {
  return ORG_PLANS[plan].limits;
}

// =============================================================================
// Organization CRUD Operations
// =============================================================================

/**
 * Create a new organization (called after Stripe checkout completes)
 */
export async function createOrganization(data: {
  name: string;
  plan: OrgPlanId;
  adminUserId: string;
  adminEmail: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}): Promise<Organization> {
  const orgId = `org_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const inviteCode = generateInviteCode();

  const org: Organization = {
    id: orgId,
    name: data.name,
    plan: data.plan,
    stripeCustomerId: data.stripeCustomerId || null,
    stripeSubscriptionId: data.stripeSubscriptionId || null,
    adminUserId: data.adminUserId,
    adminEmail: data.adminEmail,
    emailDomain: null,
    inviteCode,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  // Save organization
  await setDoc(doc(db, 'organizations', orgId), org);

  // Add admin as first member
  const adminMember: OrgMember = {
    id: data.adminUserId,
    orgId,
    userId: data.adminUserId,
    email: data.adminEmail,
    displayName: data.name, // Will be updated with actual name
    role: 'admin',
    joinedAt: Timestamp.now(),
    status: 'active',
  };
  await setDoc(doc(db, 'organizations', orgId, 'members', data.adminUserId), adminMember);

  return org;
}

/**
 * Get organization by ID
 */
export async function getOrganization(orgId: string): Promise<Organization | null> {
  const docSnap = await getDoc(doc(db, 'organizations', orgId));
  if (!docSnap.exists()) return null;
  return docSnap.data() as Organization;
}

/**
 * Get organization by invite code
 */
export async function getOrganizationByInviteCode(inviteCode: string): Promise<Organization | null> {
  const q = query(collection(db, 'organizations'), where('inviteCode', '==', inviteCode.toLowerCase()));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as Organization;
}

/**
 * Update organization settings
 * SECURITY: Requires admin verification
 */
export async function updateOrganization(
  orgId: string,
  adminUserId: string,
  updates: Partial<Pick<Organization, 'name' | 'emailDomain'>>
): Promise<{ success: boolean; error?: string }> {
  // Verify the caller is the org admin
  const org = await getOrganization(orgId);
  if (!org) {
    return { success: false, error: 'Organization not found' };
  }

  if (org.adminUserId !== adminUserId) {
    return { success: false, error: 'Only organization admins can update settings' };
  }

  await updateDoc(doc(db, 'organizations', orgId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });

  return { success: true };
}

/**
 * Regenerate invite code for an organization
 * SECURITY: Requires admin verification
 */
export async function regenerateInviteCode(
  orgId: string,
  adminUserId: string
): Promise<{ success: boolean; newCode?: string; error?: string }> {
  // Verify the caller is the org admin
  const org = await getOrganization(orgId);
  if (!org) {
    return { success: false, error: 'Organization not found' };
  }

  if (org.adminUserId !== adminUserId) {
    return { success: false, error: 'Only organization admins can regenerate invite codes' };
  }

  const newCode = generateInviteCode();
  await updateDoc(doc(db, 'organizations', orgId), {
    inviteCode: newCode,
    updatedAt: serverTimestamp(),
  });

  return { success: true, newCode };
}

// =============================================================================
// Member Management
// =============================================================================

/**
 * Get all members of an organization
 */
export async function getOrgMembers(orgId: string): Promise<OrgMember[]> {
  const snapshot = await getDocs(collection(db, 'organizations', orgId, 'members'));
  return snapshot.docs.map(d => d.data() as OrgMember);
}

/**
 * Get active member count for an organization
 */
export async function getActiveMemberCount(orgId: string): Promise<number> {
  const q = query(
    collection(db, 'organizations', orgId, 'members'),
    where('status', '==', 'active')
  );
  const snapshot = await getDocs(q);
  return snapshot.size;
}

/**
 * Add a teacher to an organization (via invite link)
 */
export async function joinOrganization(
  orgId: string,
  user: { userId: string; email: string; displayName: string }
): Promise<{ success: boolean; error?: string }> {
  // Get the organization
  const org = await getOrganization(orgId);
  if (!org) {
    return { success: false, error: 'Organization not found' };
  }

  // Check if already a member
  const memberDoc = await getDoc(doc(db, 'organizations', orgId, 'members', user.userId));
  if (memberDoc.exists()) {
    const member = memberDoc.data() as OrgMember;
    if (member.status === 'active') {
      return { success: false, error: 'You are already a member of this organization' };
    }
    // Reactivate if previously removed
    await updateDoc(doc(db, 'organizations', orgId, 'members', user.userId), {
      status: 'active',
      joinedAt: serverTimestamp(),
    });
    return { success: true };
  }

  // Check member limit
  const memberCount = await getActiveMemberCount(orgId);
  const limits = getOrgLimits(org.plan);
  if (memberCount >= limits.teachers) {
    return {
      success: false,
      error: `This organization has reached its limit of ${limits.teachers} teachers`
    };
  }

  // Add new member
  const newMember: OrgMember = {
    id: user.userId,
    orgId,
    userId: user.userId,
    email: user.email,
    displayName: user.displayName,
    role: 'teacher',
    joinedAt: Timestamp.now(),
    status: 'active',
  };
  await setDoc(doc(db, 'organizations', orgId, 'members', user.userId), newMember);

  // Update user's organization membership in their userData
  await addOrgMembershipToUser(user.userId, {
    orgId,
    orgName: org.name,
    role: 'teacher',
    joinedAt: Timestamp.now(),
  });

  return { success: true };
}

/**
 * Remove a member from an organization (internal function)
 * Note: This should only be called after authorization is verified
 */
async function removeMemberInternal(orgId: string, userId: string): Promise<void> {
  // Mark as removed (don't delete to preserve history)
  await updateDoc(doc(db, 'organizations', orgId, 'members', userId), {
    status: 'removed',
  });

  // Remove from user's organization list
  await removeOrgMembershipFromUser(userId, orgId);
}

/**
 * Remove a member from an organization
 * SECURITY: Requires admin verification
 */
export async function removeMemberFromOrg(
  orgId: string,
  adminUserId: string,
  targetUserId: string
): Promise<{ success: boolean; error?: string }> {
  // Verify the caller is the org admin
  const org = await getOrganization(orgId);
  if (!org) {
    return { success: false, error: 'Organization not found' };
  }

  if (org.adminUserId !== adminUserId) {
    return { success: false, error: 'Only organization admins can remove members' };
  }

  // Cannot remove the admin
  if (targetUserId === org.adminUserId) {
    return { success: false, error: 'Cannot remove the organization admin' };
  }

  await removeMemberInternal(orgId, targetUserId);
  return { success: true };
}

/**
 * Leave an organization voluntarily
 */
export async function leaveOrganization(orgId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  const org = await getOrganization(orgId);
  if (!org) {
    return { success: false, error: 'Organization not found' };
  }

  // Admin cannot leave (must transfer ownership first)
  if (org.adminUserId === userId) {
    return { success: false, error: 'Organization admin cannot leave. Transfer ownership first.' };
  }

  await removeMemberInternal(orgId, userId);
  return { success: true };
}

// =============================================================================
// User Organization Membership Helpers
// =============================================================================

/**
 * Add organization membership to a user's userData document
 */
async function addOrgMembershipToUser(userId: string, membership: UserOrgMembership): Promise<void> {
  const userDocRef = doc(db, 'userData', `quizforge-account-${userId}`);
  const userDoc = await getDoc(userDocRef);

  if (userDoc.exists()) {
    await updateDoc(userDocRef, {
      organizations: arrayUnion(membership),
    });
  }
}

/**
 * Remove organization membership from a user's userData document
 */
async function removeOrgMembershipFromUser(userId: string, orgId: string): Promise<void> {
  const userDocRef = doc(db, 'userData', `quizforge-account-${userId}`);
  const userDoc = await getDoc(userDocRef);

  if (userDoc.exists()) {
    const userData = userDoc.data() as UserDataWithOrgs;
    const updatedOrgs = (userData.organizations || []).filter(o => o.orgId !== orgId);
    await updateDoc(userDocRef, {
      organizations: updatedOrgs,
    });
  }
}

/**
 * Get all organizations a user belongs to
 */
export async function getUserOrganizations(userId: string): Promise<UserOrgMembership[]> {
  const userDocRef = doc(db, 'userData', `quizforge-account-${userId}`);
  const userDoc = await getDoc(userDocRef);

  if (!userDoc.exists()) return [];

  const userData = userDoc.data() as UserDataWithOrgs;
  return userData.organizations || [];
}

// =============================================================================
// Limit Enforcement
// =============================================================================

/**
 * Get the effective limits for a user (considers org membership)
 * Uses Option B: org overrides personal plan, use BEST available limit
 */
export async function getEffectiveLimits(userId: string, personalPlan: 'free' | 'pro' = 'free'): Promise<{
  quizzesPerMonth: number;
  classesMax: number;
  studentsPerClass: number;
  source: 'personal' | 'organization';
  orgName?: string;
}> {
  // Personal plan limits
  const personalLimits = {
    free: { quizzesPerMonth: 5, classesMax: 1, studentsPerClass: 30 },
    pro: { quizzesPerMonth: 25, classesMax: 3, studentsPerClass: 50 },
  };

  const personal = personalLimits[personalPlan];

  // Get user's organizations
  const orgs = await getUserOrganizations(userId);

  if (orgs.length === 0) {
    return { ...personal, source: 'personal' };
  }

  // Find the org with the best limits
  let bestOrgLimits = personal;
  let bestOrgName = '';

  for (const membership of orgs) {
    const org = await getOrganization(membership.orgId);
    if (!org) continue;

    const orgLimits = getOrgLimits(org.plan);

    // Use the highest quiz limit as the deciding factor
    if (orgLimits.quizzesPerTeacher > bestOrgLimits.quizzesPerMonth) {
      bestOrgLimits = {
        quizzesPerMonth: orgLimits.quizzesPerTeacher,
        classesMax: orgLimits.classesPerTeacher,
        studentsPerClass: orgLimits.studentsPerClass,
      };
      bestOrgName = org.name;
    }
  }

  // Compare with personal and return the better one
  if (bestOrgLimits.quizzesPerMonth > personal.quizzesPerMonth) {
    return { ...bestOrgLimits, source: 'organization', orgName: bestOrgName };
  }

  return { ...personal, source: 'personal' };
}

/**
 * Check if a user can create a quiz (within their effective limits)
 */
export async function canCreateQuiz(
  userId: string,
  quizzesThisMonth: number,
  personalPlan: 'free' | 'pro' = 'free'
): Promise<{ allowed: boolean; reason?: string }> {
  const limits = await getEffectiveLimits(userId, personalPlan);

  if (quizzesThisMonth >= limits.quizzesPerMonth) {
    return {
      allowed: false,
      reason: `You've reached your ${limits.quizzesPerMonth} quiz limit for this month. ${
        limits.source === 'personal' ? 'Upgrade for more quizzes.' : ''
      }`,
    };
  }

  return { allowed: true };
}

/**
 * Check if a user can create a class (within their effective limits)
 */
export async function canCreateClass(
  userId: string,
  currentClassCount: number,
  personalPlan: 'free' | 'pro' = 'free'
): Promise<{ allowed: boolean; reason?: string }> {
  const limits = await getEffectiveLimits(userId, personalPlan);

  if (currentClassCount >= limits.classesMax) {
    return {
      allowed: false,
      reason: `You've reached your ${limits.classesMax} class limit. ${
        limits.source === 'personal' ? 'Upgrade to add more classes.' : 'Contact your organization admin.'
      }`,
    };
  }

  return { allowed: true };
}

// =============================================================================
// Organization Quiz Sharing
// =============================================================================

export interface SharedQuiz {
  id: string;
  title: string;
  subject: string;
  questions: {
    question: string;
    options: { text: string; isCorrect: boolean }[];
    explanation: string;
    topic?: string;
    difficulty?: string;
  }[];
  sharedBy: string;
  sharedByName: string;
  sharedByEmail: string;
  sharedAt: Timestamp;
  usageCount: number;
  tags?: string[];
  questionCount: number;
}

/**
 * Share a quiz with the organization
 */
export async function shareQuizWithOrg(
  orgId: string,
  user: { userId: string; displayName: string; email: string },
  quiz: {
    id: string;
    title: string;
    subject: string;
    questions: SharedQuiz['questions'];
    tags?: string[];
  }
): Promise<{ success: boolean; sharedQuizId?: string; error?: string }> {
  try {
    // Verify user is a member of the org
    const memberDoc = await getDoc(doc(db, 'organizations', orgId, 'members', user.userId));
    if (!memberDoc.exists() || (memberDoc.data() as OrgMember).status !== 'active') {
      return { success: false, error: 'You are not a member of this organization' };
    }

    // Create shared quiz document
    const sharedQuizId = `shared_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sharedQuiz: SharedQuiz = {
      id: sharedQuizId,
      title: quiz.title,
      subject: quiz.subject,
      questions: quiz.questions,
      sharedBy: user.userId,
      sharedByName: user.displayName,
      sharedByEmail: user.email,
      sharedAt: Timestamp.now(),
      usageCount: 0,
      tags: quiz.tags || [],
      questionCount: quiz.questions.length,
    };

    await setDoc(doc(db, 'organizations', orgId, 'sharedQuizzes', sharedQuizId), sharedQuiz);

    return { success: true, sharedQuizId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to share quiz',
    };
  }
}

/**
 * Get all shared quizzes in an organization
 */
export async function getOrgSharedQuizzes(orgId: string): Promise<SharedQuiz[]> {
  const q = query(
    collection(db, 'organizations', orgId, 'sharedQuizzes'),
    orderBy('sharedAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => d.data() as SharedQuiz);
}

/**
 * Get shared quizzes filtered by subject
 */
export async function getOrgSharedQuizzesBySubject(orgId: string, subject: string): Promise<SharedQuiz[]> {
  const q = query(
    collection(db, 'organizations', orgId, 'sharedQuizzes'),
    where('subject', '==', subject),
    orderBy('sharedAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => d.data() as SharedQuiz);
}

/**
 * Copy a shared quiz to a teacher's personal quizzes
 */
export async function copySharedQuizToUser(
  orgId: string,
  sharedQuizId: string,
  userId: string
): Promise<{ success: boolean; newQuizId?: string; error?: string }> {
  try {
    // Get the shared quiz
    const sharedQuizRef = doc(db, 'organizations', orgId, 'sharedQuizzes', sharedQuizId);
    const sharedQuizSnap = await getDoc(sharedQuizRef);

    if (!sharedQuizSnap.exists()) {
      return { success: false, error: 'Shared quiz not found' };
    }

    const sharedQuiz = sharedQuizSnap.data() as SharedQuiz;

    // Increment usage count
    await updateDoc(sharedQuizRef, {
      usageCount: sharedQuiz.usageCount + 1,
    });

    // Create new quiz ID for the copy
    const newQuizId = `quiz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Return the quiz data - caller is responsible for saving to their quizzes
    return {
      success: true,
      newQuizId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to copy quiz',
    };
  }
}

/**
 * Get a single shared quiz by ID
 */
export async function getSharedQuizById(orgId: string, sharedQuizId: string): Promise<SharedQuiz | null> {
  const sharedQuizRef = doc(db, 'organizations', orgId, 'sharedQuizzes', sharedQuizId);
  const sharedQuizSnap = await getDoc(sharedQuizRef);

  if (!sharedQuizSnap.exists()) {
    return null;
  }

  return sharedQuizSnap.data() as SharedQuiz;
}

/**
 * Delete a shared quiz (only owner or admin can delete)
 */
export async function deleteSharedQuiz(
  orgId: string,
  sharedQuizId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the shared quiz
    const sharedQuizRef = doc(db, 'organizations', orgId, 'sharedQuizzes', sharedQuizId);
    const sharedQuizSnap = await getDoc(sharedQuizRef);

    if (!sharedQuizSnap.exists()) {
      return { success: false, error: 'Shared quiz not found' };
    }

    const sharedQuiz = sharedQuizSnap.data() as SharedQuiz;

    // Check if user is owner or admin
    const org = await getOrganization(orgId);
    if (!org) {
      return { success: false, error: 'Organization not found' };
    }

    const isOwner = sharedQuiz.sharedBy === userId;
    const isAdmin = org.adminUserId === userId;

    if (!isOwner && !isAdmin) {
      return { success: false, error: 'Only the quiz owner or organization admin can delete shared quizzes' };
    }

    await deleteDoc(sharedQuizRef);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete shared quiz',
    };
  }
}
