// lib/storage.ts
// Storage service that replaces artifact's window.storage
// Uses Firebase Firestore for production persistence

import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';

interface StorageResult {
  key: string;
  value: string;
  shared?: boolean;
}

class StorageService {
  private userId: string | null = null;

  setUser(userId: string | null) {
    this.userId = userId;
  }

  async get(key: string, shared = false): Promise<StorageResult | null> {
    try {
      const collectionName = shared ? 'shared_data' : 'user_data';
      const docId = shared ? key : `${this.userId}_${key}`;
      
      const docRef = doc(db, collectionName, docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          key,
          value: docSnap.data().value,
          shared,
        };
      }
      return null;
    } catch (error) {
      console.error('Storage get error:', error);
      throw error;
    }
  }

  async set(key: string, value: string, shared = false): Promise<StorageResult | null> {
    try {
      if (!this.userId && !shared) {
        throw new Error('User not authenticated');
      }

      const collectionName = shared ? 'shared_data' : 'user_data';
      const docId = shared ? key : `${this.userId}_${key}`;
      
      const docRef = doc(db, collectionName, docId);
      await setDoc(docRef, {
        key,
        value,
        userId: shared ? null : this.userId,
        updatedAt: serverTimestamp(),
      });

      return { key, value, shared };
    } catch (error) {
      console.error('Storage set error:', error);
      throw error;
    }
  }

  async delete(key: string, shared = false): Promise<{ key: string; deleted: boolean; shared: boolean } | null> {
    try {
      const collectionName = shared ? 'shared_data' : 'user_data';
      const docId = shared ? key : `${this.userId}_${key}`;
      
      const docRef = doc(db, collectionName, docId);
      await deleteDoc(docRef);

      return { key, deleted: true, shared };
    } catch (error) {
      console.error('Storage delete error:', error);
      throw error;
    }
  }

  async list(prefix?: string, shared = false): Promise<{ keys: string[]; prefix?: string; shared: boolean } | null> {
    try {
      const collectionName = shared ? 'shared_data' : 'user_data';
      const colRef = collection(db, collectionName);
      
      let q;
      if (shared) {
        q = query(colRef);
      } else {
        q = query(colRef, where('userId', '==', this.userId));
      }

      const snapshot = await getDocs(q);
      let keys = snapshot.docs.map((doc) => doc.data().key as string);

      if (prefix) {
        keys = keys.filter((key) => key.startsWith(prefix));
      }

      return { keys, prefix, shared };
    } catch (error) {
      console.error('Storage list error:', error);
      throw error;
    }
  }
}

export const storage = new StorageService();

// For compatibility with artifact code
if (typeof window !== 'undefined') {
  (window as any).storage = storage;
}
