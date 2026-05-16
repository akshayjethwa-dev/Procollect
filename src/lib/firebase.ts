// src/lib/firebase.ts
/// <reference types="vite/client" />

import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  onAuthStateChanged,
  User,
  getIdTokenResult
} from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  writeBatch,
  getDocFromCache,
  getDocFromServer,
  Timestamp,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { 
  getStorage, 
  ref as storageRef, 
  uploadBytesResumable, 
  getDownloadURL 
} from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const db = !getApps().length 
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    })
  : getFirestore(app);

export const storage = getStorage(app);
export const functions = getFunctions(app);

// Helper to get the user's agency ID from Custom Claims or Firestore fallback
export const getUserAgencyId = async (): Promise<string> => {
  const user = auth.currentUser;
  // Fallback if not logged in
  if (!user) return ''; 
  
  try {
    // 1. Check custom claims first (ignore if it's 'UNASSIGNED')
    const tokenResult = await getIdTokenResult(user);
    if (tokenResult.claims && tokenResult.claims.agencyId && tokenResult.claims.agencyId !== 'UNASSIGNED') {
      return tokenResult.claims.agencyId as string;
    }

    // 2. Fallback to Firestore (ignore if it's 'UNASSIGNED')
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists() && userDoc.data().agencyId && userDoc.data().agencyId !== 'UNASSIGNED') {
      return userDoc.data().agencyId;
    }
  } catch (error) {
    console.warn("Could not fetch agency ID, defaulting to User ID", error);
  }

  // 3. THE FIX: Default to the user's OWN UID. 
  // This matches the backend where an independent manager IS the agency.
  return user.uid;
};

export const checkSubscriptionStatus = async (): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user) return false;
  
  const tokenResult = await getIdTokenResult(user, true);
  return !!tokenResult.claims.isSubscribed;
};

export {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  getIdTokenResult,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  getDocFromCache,
  getDocFromServer,
  Timestamp,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  storageRef,
  uploadBytesResumable,
  getDownloadURL
};

export type { User };