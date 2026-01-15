// User Data Access Layer
// Provides abstraction for reading/writing user data with support for both
// legacy (monolithic document) and new (subcollection) data structures
//
// This enables gradual migration without breaking existing users

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  writeBatch,
  serverTimestamp,
  Timestamp,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';

// =============================================================================
// Types
// =============================================================================

export interface Quiz {
  id: string;
  title: string;
  subject: string;
  questions: QuizQuestion[];
  createdAt: string;
  tags?: string[];
  published?: boolean;
  shareId?: string;
}

export interface QuizQuestion {
  question: string;
  options: { text: string; isCorrect: boolean }[];
  explanation: string;
  topic?: string;
  difficulty?: string;
}

export interface UserClass {
  id: string;
  name: string;
  code: string;
  teacherId: string;
  students: string[];
  createdAt: string;
}

export interface UserProgress {
  totalQuizzesTaken: number;
  totalQuestionsAnswered: number;
  correctAnswers: number;
  averageScore: number;
  streakCurrent: number;
  streakLongest: number;
  lastActiveDate: string;
  topicPerformance: Record<string, { correct: number; total: number }>;
  questionHistory: Record<string, { correct: number; wrong: number; lastSeen: string }>;
  dailyHistory: { date: string; quizzesTaken: number; questionsAnswered: number; correctAnswers: number }[];
  scoreHistory: number[];
}

export interface UserAchievements {
  firstQuiz: boolean;
  onFire: boolean;
  weekWarrior: boolean;
  dedicatedLearner: boolean;
  quizMaster: boolean;
  perfectScore: boolean;
  starStudent: boolean;
}

export interface UserProfile {
  name: string;
  email: string;
  role: 'teacher' | 'student' | 'creator';
  createdAt: string;
  plan?: 'free' | 'pro';
  stripeCustomerId?: string;
  organizations?: { orgId: string; orgName: string; role: string; joinedAt: Timestamp }[];
  migrated?: boolean; // Flag indicating user has been migrated to subcollections
  migratedAt?: Timestamp;
}

export interface LegacyUserData {
  quizzes: Quiz[];
  classes: UserClass[];
  progress: UserProgress;
  achievements: UserAchievements;
  joinedClasses?: string[];
  assignments?: Record<string, unknown>;
}

// =============================================================================
// Migration Status
// =============================================================================

/**
 * Check if a user has been migrated to the new subcollection structure
 */
export async function isUserMigrated(userId: string): Promise<boolean> {
  const profileRef = doc(db, 'users', userId, 'profile', 'main');
  const profileSnap = await getDoc(profileRef);

  if (profileSnap.exists()) {
    const profile = profileSnap.data() as UserProfile;
    return profile.migrated === true;
  }

  return false;
}

/**
 * Get user's account data (profile info)
 */
export async function getUserAccount(userId: string): Promise<UserProfile | null> {
  // First try new location
  const newProfileRef = doc(db, 'users', userId, 'profile', 'main');
  const newSnap = await getDoc(newProfileRef);

  if (newSnap.exists()) {
    return newSnap.data() as UserProfile;
  }

  // Fall back to legacy location
  const legacyRef = doc(db, 'userData', `quizforge-account-${userId}`);
  const legacySnap = await getDoc(legacyRef);

  if (legacySnap.exists()) {
    return legacySnap.data() as UserProfile;
  }

  return null;
}

// =============================================================================
// Quiz Operations
// =============================================================================

/**
 * Get all quizzes for a user
 */
export async function getUserQuizzes(userId: string): Promise<Quiz[]> {
  const migrated = await isUserMigrated(userId);

  if (migrated) {
    // Read from subcollection
    const quizzesRef = collection(db, 'users', userId, 'quizzes');
    const q = query(quizzesRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Quiz));
  }

  // Read from legacy document
  const legacyRef = doc(db, 'userData', `quizforge-data-${userId}`);
  const legacySnap = await getDoc(legacyRef);

  if (legacySnap.exists()) {
    const data = legacySnap.data() as LegacyUserData;
    return data.quizzes || [];
  }

  return [];
}

/**
 * Get paginated quizzes for a user
 */
export async function getUserQuizzesPaginated(
  userId: string,
  pageSize: number = 20,
  lastDoc?: DocumentSnapshot
): Promise<{ quizzes: Quiz[]; lastDoc: DocumentSnapshot | null; hasMore: boolean }> {
  const migrated = await isUserMigrated(userId);

  if (migrated) {
    const quizzesRef = collection(db, 'users', userId, 'quizzes');
    let q = query(quizzesRef, orderBy('createdAt', 'desc'), limit(pageSize + 1));

    if (lastDoc) {
      q = query(quizzesRef, orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(pageSize + 1));
    }

    const snapshot = await getDocs(q);
    const docs = snapshot.docs;
    const hasMore = docs.length > pageSize;
    const quizzes = docs.slice(0, pageSize).map(d => ({ id: d.id, ...d.data() } as Quiz));
    const newLastDoc = docs.length > 0 ? docs[Math.min(docs.length - 1, pageSize - 1)] : null;

    return { quizzes, lastDoc: newLastDoc, hasMore };
  }

  // Legacy users don't support pagination - return all
  const quizzes = await getUserQuizzes(userId);
  return { quizzes, lastDoc: null, hasMore: false };
}

/**
 * Get a single quiz by ID
 */
export async function getQuizById(userId: string, quizId: string): Promise<Quiz | null> {
  const migrated = await isUserMigrated(userId);

  if (migrated) {
    const quizRef = doc(db, 'users', userId, 'quizzes', quizId);
    const quizSnap = await getDoc(quizRef);

    if (quizSnap.exists()) {
      return { id: quizSnap.id, ...quizSnap.data() } as Quiz;
    }
    return null;
  }

  // Search in legacy document
  const quizzes = await getUserQuizzes(userId);
  return quizzes.find(q => q.id === quizId) || null;
}

/**
 * Save a quiz (create or update)
 */
export async function saveUserQuiz(userId: string, quiz: Quiz): Promise<void> {
  const migrated = await isUserMigrated(userId);

  if (migrated) {
    // Save to subcollection
    const quizRef = doc(db, 'users', userId, 'quizzes', quiz.id);
    await setDoc(quizRef, {
      ...quiz,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  // Save to legacy document (update array)
  const legacyRef = doc(db, 'userData', `quizforge-data-${userId}`);
  const legacySnap = await getDoc(legacyRef);

  if (legacySnap.exists()) {
    const data = legacySnap.data() as LegacyUserData;
    const quizzes = data.quizzes || [];
    const existingIndex = quizzes.findIndex(q => q.id === quiz.id);

    if (existingIndex >= 0) {
      quizzes[existingIndex] = quiz;
    } else {
      quizzes.unshift(quiz);
    }

    await updateDoc(legacyRef, { quizzes });
  } else {
    // Create new document with quiz
    await setDoc(legacyRef, { quizzes: [quiz], classes: [], progress: getDefaultProgress(), achievements: getDefaultAchievements() });
  }
}

/**
 * Delete a quiz
 */
export async function deleteUserQuiz(userId: string, quizId: string): Promise<void> {
  const migrated = await isUserMigrated(userId);

  if (migrated) {
    const quizRef = doc(db, 'users', userId, 'quizzes', quizId);
    await deleteDoc(quizRef);
    return;
  }

  // Delete from legacy document
  const legacyRef = doc(db, 'userData', `quizforge-data-${userId}`);
  const legacySnap = await getDoc(legacyRef);

  if (legacySnap.exists()) {
    const data = legacySnap.data() as LegacyUserData;
    const quizzes = (data.quizzes || []).filter(q => q.id !== quizId);
    await updateDoc(legacyRef, { quizzes });
  }
}

// =============================================================================
// Progress Operations
// =============================================================================

/**
 * Get user progress data
 */
export async function getUserProgress(userId: string): Promise<UserProgress> {
  const migrated = await isUserMigrated(userId);

  if (migrated) {
    const progressRef = doc(db, 'users', userId, 'progress', 'summary');
    const progressSnap = await getDoc(progressRef);

    if (progressSnap.exists()) {
      return progressSnap.data() as UserProgress;
    }
    return getDefaultProgress();
  }

  // Read from legacy document
  const legacyRef = doc(db, 'userData', `quizforge-data-${userId}`);
  const legacySnap = await getDoc(legacyRef);

  if (legacySnap.exists()) {
    const data = legacySnap.data() as LegacyUserData;
    return data.progress || getDefaultProgress();
  }

  return getDefaultProgress();
}

/**
 * Update user progress
 */
export async function updateUserProgress(userId: string, progress: Partial<UserProgress>): Promise<void> {
  const migrated = await isUserMigrated(userId);

  if (migrated) {
    const progressRef = doc(db, 'users', userId, 'progress', 'summary');
    await setDoc(progressRef, { ...progress, updatedAt: serverTimestamp() }, { merge: true });
    return;
  }

  // Update legacy document
  const legacyRef = doc(db, 'userData', `quizforge-data-${userId}`);
  const legacySnap = await getDoc(legacyRef);

  if (legacySnap.exists()) {
    const data = legacySnap.data() as LegacyUserData;
    const currentProgress = data.progress || getDefaultProgress();
    await updateDoc(legacyRef, { progress: { ...currentProgress, ...progress } });
  }
}

// =============================================================================
// Achievements Operations
// =============================================================================

/**
 * Get user achievements
 */
export async function getUserAchievements(userId: string): Promise<UserAchievements> {
  const migrated = await isUserMigrated(userId);

  if (migrated) {
    const achievementsRef = doc(db, 'users', userId, 'achievements', 'main');
    const achievementsSnap = await getDoc(achievementsRef);

    if (achievementsSnap.exists()) {
      return achievementsSnap.data() as UserAchievements;
    }
    return getDefaultAchievements();
  }

  // Read from legacy document
  const legacyRef = doc(db, 'userData', `quizforge-data-${userId}`);
  const legacySnap = await getDoc(legacyRef);

  if (legacySnap.exists()) {
    const data = legacySnap.data() as LegacyUserData;
    return data.achievements || getDefaultAchievements();
  }

  return getDefaultAchievements();
}

/**
 * Update user achievements
 */
export async function updateUserAchievements(userId: string, achievements: Partial<UserAchievements>): Promise<void> {
  const migrated = await isUserMigrated(userId);

  if (migrated) {
    const achievementsRef = doc(db, 'users', userId, 'achievements', 'main');
    await setDoc(achievementsRef, achievements, { merge: true });
    return;
  }

  // Update legacy document
  const legacyRef = doc(db, 'userData', `quizforge-data-${userId}`);
  const legacySnap = await getDoc(legacyRef);

  if (legacySnap.exists()) {
    const data = legacySnap.data() as LegacyUserData;
    const currentAchievements = data.achievements || getDefaultAchievements();
    await updateDoc(legacyRef, { achievements: { ...currentAchievements, ...achievements } });
  }
}

// =============================================================================
// Classes Operations (for teachers)
// =============================================================================

/**
 * Get all classes for a teacher
 */
export async function getTeacherClasses(userId: string): Promise<UserClass[]> {
  const migrated = await isUserMigrated(userId);

  if (migrated) {
    const classesRef = collection(db, 'users', userId, 'classes');
    const q = query(classesRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as UserClass));
  }

  // Read from legacy document
  const legacyRef = doc(db, 'userData', `quizforge-data-${userId}`);
  const legacySnap = await getDoc(legacyRef);

  if (legacySnap.exists()) {
    const data = legacySnap.data() as LegacyUserData;
    return data.classes || [];
  }

  return [];
}

// =============================================================================
// Bulk Operations (for full data sync)
// =============================================================================

/**
 * Get all user data at once (for initial load)
 * Returns data in the format expected by QuizForge.jsx
 */
export async function getAllUserData(userId: string): Promise<LegacyUserData> {
  const migrated = await isUserMigrated(userId);

  if (migrated) {
    // Parallel fetch from subcollections
    const [quizzes, progress, achievements] = await Promise.all([
      getUserQuizzes(userId),
      getUserProgress(userId),
      getUserAchievements(userId),
    ]);

    // For classes, we still need to fetch from global collection for now
    // (classes are stored globally with teacherId field)

    return {
      quizzes,
      classes: [], // Classes loaded separately from global collection
      progress,
      achievements,
    };
  }

  // Return legacy document directly
  const legacyRef = doc(db, 'userData', `quizforge-data-${userId}`);
  const legacySnap = await getDoc(legacyRef);

  if (legacySnap.exists()) {
    return legacySnap.data() as LegacyUserData;
  }

  return {
    quizzes: [],
    classes: [],
    progress: getDefaultProgress(),
    achievements: getDefaultAchievements(),
  };
}

/**
 * Save all user data at once (for bulk updates)
 * Maintains backward compatibility with legacy code
 */
export async function saveAllUserData(userId: string, data: Partial<LegacyUserData>): Promise<void> {
  const migrated = await isUserMigrated(userId);

  if (migrated) {
    // Write to subcollections in batch
    const batch = writeBatch(db);

    if (data.progress) {
      const progressRef = doc(db, 'users', userId, 'progress', 'summary');
      batch.set(progressRef, { ...data.progress, updatedAt: serverTimestamp() }, { merge: true });
    }

    if (data.achievements) {
      const achievementsRef = doc(db, 'users', userId, 'achievements', 'main');
      batch.set(achievementsRef, data.achievements, { merge: true });
    }

    // Quizzes need individual handling due to their size
    // This function doesn't handle quiz updates - use saveUserQuiz instead

    await batch.commit();
    return;
  }

  // Update legacy document
  const legacyRef = doc(db, 'userData', `quizforge-data-${userId}`);
  await setDoc(legacyRef, data, { merge: true });
}

// =============================================================================
// Helpers
// =============================================================================

function getDefaultProgress(): UserProgress {
  return {
    totalQuizzesTaken: 0,
    totalQuestionsAnswered: 0,
    correctAnswers: 0,
    averageScore: 0,
    streakCurrent: 0,
    streakLongest: 0,
    lastActiveDate: '',
    topicPerformance: {},
    questionHistory: {},
    dailyHistory: [],
    scoreHistory: [],
  };
}

function getDefaultAchievements(): UserAchievements {
  return {
    firstQuiz: false,
    onFire: false,
    weekWarrior: false,
    dedicatedLearner: false,
    quizMaster: false,
    perfectScore: false,
    starStudent: false,
  };
}

// =============================================================================
// Quiz Count for Limits
// =============================================================================

/**
 * Get count of quizzes created this month (for plan limit checking)
 */
export async function getQuizzesThisMonth(userId: string): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const quizzes = await getUserQuizzes(userId);
  return quizzes.filter(q => q.createdAt >= startOfMonth).length;
}
