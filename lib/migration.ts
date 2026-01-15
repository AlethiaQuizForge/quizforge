// User Data Migration Utilities
// Handles migration from monolithic document structure to subcollections
//
// Migration process:
// 1. Read all data from legacy document
// 2. Write to new subcollection structure
// 3. Mark user as migrated
// 4. Keep legacy document for rollback safety

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { LegacyUserData, UserProfile, Quiz, UserProgress, UserAchievements } from './userData';

// =============================================================================
// Types
// =============================================================================

export interface MigrationResult {
  success: boolean;
  userId: string;
  quizzesMigrated: number;
  error?: string;
  durationMs: number;
}

export interface MigrationStatus {
  migrated: boolean;
  migratedAt?: Date;
  legacyDataExists: boolean;
  newDataExists: boolean;
}

// =============================================================================
// Migration Status Checking
// =============================================================================

/**
 * Check the migration status of a user
 */
export async function getMigrationStatus(userId: string): Promise<MigrationStatus> {
  // Check new structure
  const newProfileRef = doc(db, 'users', userId, 'profile', 'main');
  const newProfileSnap = await getDoc(newProfileRef);
  const newDataExists = newProfileSnap.exists();

  // Check legacy structure
  const legacyRef = doc(db, 'userData', `quizforge-data-${userId}`);
  const legacySnap = await getDoc(legacyRef);
  const legacyDataExists = legacySnap.exists();

  // Check if explicitly marked as migrated
  let migrated = false;
  let migratedAt: Date | undefined;

  if (newProfileSnap.exists()) {
    const profile = newProfileSnap.data() as UserProfile;
    migrated = profile.migrated === true;
    if (profile.migratedAt) {
      migratedAt = profile.migratedAt.toDate();
    }
  }

  return {
    migrated,
    migratedAt,
    legacyDataExists,
    newDataExists,
  };
}

// =============================================================================
// Single User Migration
// =============================================================================

/**
 * Migrate a single user from legacy to subcollection structure
 */
export async function migrateUser(userId: string): Promise<MigrationResult> {
  const startTime = Date.now();

  try {
    // Check if already migrated
    const status = await getMigrationStatus(userId);
    if (status.migrated) {
      return {
        success: true,
        userId,
        quizzesMigrated: 0,
        durationMs: Date.now() - startTime,
        error: 'User already migrated',
      };
    }

    // Get legacy data
    const legacyDataRef = doc(db, 'userData', `quizforge-data-${userId}`);
    const legacyDataSnap = await getDoc(legacyDataRef);

    if (!legacyDataSnap.exists()) {
      // No legacy data - just mark as migrated with empty data
      const profileRef = doc(db, 'users', userId, 'profile', 'main');
      await setDoc(profileRef, {
        migrated: true,
        migratedAt: serverTimestamp(),
      });

      return {
        success: true,
        userId,
        quizzesMigrated: 0,
        durationMs: Date.now() - startTime,
      };
    }

    const legacyData = legacyDataSnap.data() as LegacyUserData;

    // Get account data (for profile info)
    const accountRef = doc(db, 'userData', `quizforge-account-${userId}`);
    const accountSnap = await getDoc(accountRef);
    const accountData = accountSnap.exists() ? accountSnap.data() as UserProfile : null;

    // Migrate in batches (Firestore limit: 500 writes per batch)
    const quizzes = legacyData.quizzes || [];
    const BATCH_SIZE = 400; // Leave room for other writes

    // First batch: profile, progress, achievements
    const batch1 = writeBatch(db);

    // Profile (merge with account data)
    const profileRef = doc(db, 'users', userId, 'profile', 'main');
    batch1.set(profileRef, {
      ...(accountData || {}),
      migrated: true,
      migratedAt: serverTimestamp(),
    });

    // Progress
    if (legacyData.progress) {
      const progressRef = doc(db, 'users', userId, 'progress', 'summary');
      batch1.set(progressRef, {
        ...legacyData.progress,
        migratedAt: serverTimestamp(),
      });
    }

    // Achievements
    if (legacyData.achievements) {
      const achievementsRef = doc(db, 'users', userId, 'achievements', 'main');
      batch1.set(achievementsRef, legacyData.achievements);
    }

    await batch1.commit();

    // Migrate quizzes in batches
    for (let i = 0; i < quizzes.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const batchQuizzes = quizzes.slice(i, i + BATCH_SIZE);

      for (const quiz of batchQuizzes) {
        const quizRef = doc(db, 'users', userId, 'quizzes', quiz.id);
        batch.set(quizRef, {
          ...quiz,
          migratedAt: serverTimestamp(),
        });
      }

      await batch.commit();
    }

    // Note: We intentionally DO NOT delete the legacy document
    // This allows rollback if needed

    return {
      success: true,
      userId,
      quizzesMigrated: quizzes.length,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      userId,
      quizzesMigrated: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: Date.now() - startTime,
    };
  }
}

// =============================================================================
// Rollback
// =============================================================================

/**
 * Rollback a user migration (mark as not migrated)
 * Legacy data is preserved, so the system will use it again
 */
export async function rollbackMigration(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const profileRef = doc(db, 'users', userId, 'profile', 'main');
    const profileSnap = await getDoc(profileRef);

    if (profileSnap.exists()) {
      await updateDoc(profileRef, {
        migrated: false,
        rolledBackAt: serverTimestamp(),
      });
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Batch Migration (for admin use)
// =============================================================================

/**
 * Migrate multiple users in sequence
 * Returns results for each user
 */
export async function migrateUsers(userIds: string[]): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  for (const userId of userIds) {
    const result = await migrateUser(userId);
    results.push(result);

    // Small delay between users to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}

// =============================================================================
// Cleanup (only after verification)
// =============================================================================

/**
 * Delete legacy data for a migrated user
 * ONLY call this after thorough verification that migration was successful
 */
export async function cleanupLegacyData(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const status = await getMigrationStatus(userId);

    if (!status.migrated) {
      return { success: false, error: 'User not migrated - cannot cleanup' };
    }

    if (!status.newDataExists) {
      return { success: false, error: 'New data does not exist - cannot cleanup' };
    }

    // Archive the legacy document first (optional safety step)
    const legacyRef = doc(db, 'userData', `quizforge-data-${userId}`);
    const legacySnap = await getDoc(legacyRef);

    if (legacySnap.exists()) {
      // Archive to a backup collection
      const archiveRef = doc(db, 'userData-archive', `quizforge-data-${userId}`);
      await setDoc(archiveRef, {
        ...legacySnap.data(),
        archivedAt: serverTimestamp(),
      });

      // Note: Actual deletion is commented out for safety
      // Uncomment only when you're absolutely sure
      // await deleteDoc(legacyRef);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Auto-Migration on Login
// =============================================================================

/**
 * Check and trigger migration for a user on login
 * This enables gradual, automatic migration
 */
export async function checkAndMigrateOnLogin(userId: string): Promise<void> {
  const status = await getMigrationStatus(userId);

  // Only migrate if:
  // 1. User is not already migrated
  // 2. User has legacy data
  if (!status.migrated && status.legacyDataExists) {
    // Migrate in background (don't block login)
    migrateUser(userId)
      .then(result => {
        if (result.success) {
          console.log(`[Migration] User ${userId} migrated successfully: ${result.quizzesMigrated} quizzes`);
        } else {
          console.error(`[Migration] User ${userId} migration failed:`, result.error);
        }
      })
      .catch(error => {
        console.error(`[Migration] User ${userId} migration error:`, error);
      });
  }
}

// =============================================================================
// Verification
// =============================================================================

/**
 * Verify migration was successful by comparing data counts
 */
export async function verifyMigration(userId: string): Promise<{
  valid: boolean;
  legacyQuizCount: number;
  newQuizCount: number;
  mismatch: string[];
}> {
  const mismatch: string[] = [];

  // Get legacy data
  const legacyRef = doc(db, 'userData', `quizforge-data-${userId}`);
  const legacySnap = await getDoc(legacyRef);
  const legacyData = legacySnap.exists() ? legacySnap.data() as LegacyUserData : null;
  const legacyQuizCount = legacyData?.quizzes?.length || 0;

  // Get new data
  const { getDocs, collection: coll, query: q } = await import('firebase/firestore');
  const quizzesRef = coll(db, 'users', userId, 'quizzes');
  const quizzesSnap = await getDocs(quizzesRef);
  const newQuizCount = quizzesSnap.size;

  // Compare counts
  if (legacyQuizCount !== newQuizCount) {
    mismatch.push(`Quiz count mismatch: legacy=${legacyQuizCount}, new=${newQuizCount}`);
  }

  // Check profile exists
  const profileRef = doc(db, 'users', userId, 'profile', 'main');
  const profileSnap = await getDoc(profileRef);
  if (!profileSnap.exists()) {
    mismatch.push('Profile document missing');
  }

  return {
    valid: mismatch.length === 0,
    legacyQuizCount,
    newQuizCount,
    mismatch,
  };
}
