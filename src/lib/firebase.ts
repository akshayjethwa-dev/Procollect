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
  collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, writeBatch, getDocFromCache, getDocFromServer, Timestamp, serverTimestamp, increment, arrayUnion, arrayRemove
} from 'firebase/firestore';
import { 
  getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL 
} from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
// NEW: Import Realtime Database
import { getDatabase, ref as rtdbRef, set, onValue, off } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  // Add databaseURL if your RTDB is outside the default us-central1 or required by config
  databaseURL: `https://${import.meta.env.VITE_FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com` 
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
// NEW: Initialize RTDB
export const rtdb = getDatabase(app);

export const getUserAgencyId = async (): Promise<string> => {
  const user = auth.currentUser;
  if (!user) return ''; 
  
  try {
    const tokenResult = await getIdTokenResult(user);
    if (tokenResult.claims && tokenResult.claims.agencyId && tokenResult.claims.agencyId !== 'UNASSIGNED') {
      return tokenResult.claims.agencyId as string;
    }

    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists() && userDoc.data().agencyId && userDoc.data().agencyId !== 'UNASSIGNED') {
      return userDoc.data().agencyId;
    }
  } catch (error) {
    console.warn("Could not fetch agency ID, defaulting to User ID", error);
  }
  return user.uid;
};

export const checkSubscriptionStatus = async (): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user) return false;
  
  const tokenResult = await getIdTokenResult(user, true);
  return !!tokenResult.claims.isSubscribed;
};

export {
  signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, getIdTokenResult,
  collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, writeBatch, getDocFromCache, getDocFromServer, Timestamp, serverTimestamp, increment, arrayUnion, arrayRemove,
  storageRef, uploadBytesResumable, getDownloadURL,
  // NEW: Export RTDB functions
  rtdbRef, set, onValue, off
};

export type { User };