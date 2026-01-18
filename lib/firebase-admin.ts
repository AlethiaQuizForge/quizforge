// Firebase Admin SDK initialization for server-side operations
// This module provides secure authentication verification for API routes

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { NextRequest } from 'next/server';

let adminApp: App | null = null;

/**
 * Initialize Firebase Admin SDK (singleton pattern)
 * Uses environment variables for credentials
 */
function getAdminApp(): App | null {
  // Return existing instance if already initialized
  if (adminApp) {
    return adminApp;
  }

  // Check if already initialized by another import
  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    return adminApp;
  }

  // Check for required environment variables
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  // If we have service account credentials, use them
  if (projectId && clientEmail && privateKey) {
    try {
      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      return adminApp;
    } catch (error) {
      console.error('Failed to initialize Firebase Admin with service account:', error);
      return null;
    }
  }

  // Fallback: Try to initialize without credentials (works in Google Cloud environments)
  if (projectId) {
    try {
      adminApp = initializeApp({ projectId });
      return adminApp;
    } catch (error) {
      console.error('Failed to initialize Firebase Admin:', error);
      return null;
    }
  }

  console.warn('Firebase Admin SDK not configured. Server-side auth verification disabled.');
  return null;
}

/**
 * Verify a Firebase ID token from a request
 * Returns the decoded token if valid, null otherwise
 */
export async function verifyIdToken(token: string): Promise<DecodedIdToken | null> {
  const app = getAdminApp();
  if (!app) {
    console.warn('Firebase Admin not initialized, cannot verify token');
    return null;
  }

  try {
    const auth = getAuth(app);
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Extract and verify auth token from a NextRequest
 * Supports both "Bearer <token>" and raw token in Authorization header
 */
export async function verifyAuthFromRequest(request: NextRequest): Promise<{
  authenticated: boolean;
  userId?: string;
  email?: string;
  error?: string;
}> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return { authenticated: false, error: 'No authorization header' };
  }

  // Extract token (supports "Bearer <token>" format)
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  if (!token) {
    return { authenticated: false, error: 'No token provided' };
  }

  const decodedToken = await verifyIdToken(token);

  if (!decodedToken) {
    return { authenticated: false, error: 'Invalid or expired token' };
  }

  return {
    authenticated: true,
    userId: decodedToken.uid,
    email: decodedToken.email,
  };
}

/**
 * Get admin Firestore instance for server-side operations
 */
export function getAdminFirestore() {
  const app = getAdminApp();
  if (!app) {
    return null;
  }
  return getFirestore(app);
}

/**
 * Check if Firebase Admin is properly configured
 */
export function isAdminConfigured(): boolean {
  return getAdminApp() !== null;
}

/**
 * Get user data from Firestore using admin SDK
 */
export async function getServerUserData(userId: string): Promise<{
  plan?: string;
  stripeCustomerId?: string;
  email?: string;
  name?: string;
} | null> {
  const db = getAdminFirestore();
  if (!db) {
    return null;
  }

  try {
    const userDoc = await db.collection('userData').doc(`quizforge-account-${userId}`).get();
    if (!userDoc.exists) {
      return null;
    }

    const data = userDoc.data();
    if (!data) {
      return null;
    }

    // Handle the { value: JSON.stringify(...) } format
    if (data.value && typeof data.value === 'string') {
      try {
        return JSON.parse(data.value);
      } catch {
        return data;
      }
    }

    return data;
  } catch (error) {
    console.error('Failed to get user data:', error);
    return null;
  }
}

/**
 * Update user data using admin SDK
 */
export async function updateServerUserData(
  userId: string,
  updates: Record<string, unknown>
): Promise<boolean> {
  const db = getAdminFirestore();
  if (!db) {
    return false;
  }

  try {
    const userDocRef = db.collection('userData').doc(`quizforge-account-${userId}`);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return false;
    }

    const existingData = userDoc.data();
    let userData: Record<string, unknown> = {};

    // Parse existing value if it exists
    if (existingData?.value && typeof existingData.value === 'string') {
      try {
        userData = JSON.parse(existingData.value);
      } catch {
        userData = existingData;
      }
    } else if (existingData) {
      userData = existingData;
    }

    // Merge updates
    const updatedData = { ...userData, ...updates };

    // Save back in the same format
    await userDocRef.update({
      value: JSON.stringify(updatedData),
      updatedAt: new Date(),
    });

    return true;
  } catch (error) {
    console.error('Failed to update user data:', error);
    return false;
  }
}

/**
 * Store a mapping from Stripe customerId to userId for efficient lookups
 * This avoids scanning all users to find one by customerId
 */
export async function setStripeCustomerMapping(
  customerId: string,
  userId: string
): Promise<boolean> {
  const db = getAdminFirestore();
  if (!db) {
    return false;
  }

  try {
    await db.collection('stripeCustomers').doc(customerId).set({
      userId,
      createdAt: new Date(),
    });
    return true;
  } catch (error) {
    console.error('Failed to set Stripe customer mapping:', error);
    return false;
  }
}

/**
 * Get userId from Stripe customerId using indexed lookup
 * Returns null if not found
 */
export async function getUserIdByStripeCustomer(
  customerId: string
): Promise<string | null> {
  const db = getAdminFirestore();
  if (!db) {
    return null;
  }

  try {
    const doc = await db.collection('stripeCustomers').doc(customerId).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data()?.userId || null;
  } catch (error) {
    console.error('Failed to get user by Stripe customer:', error);
    return null;
  }
}
