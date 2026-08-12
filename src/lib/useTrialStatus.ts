import { useState, useEffect } from 'react';
import { auth } from './firebase';
import { db } from './db';
import { useLiveQuery } from 'dexie-react-hooks';

export function useTrialStatus() {
  // 1. Keep track of the currently logged-in user's UID
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid || null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUid(user?.uid || null);
    });
    return unsubscribe;
  }, []);

  // 2. Fetch the user's profile from the local Dexie database
  const userProfile = useLiveQuery(
    () => (uid ? db.users.get(uid) : undefined),
    [uid]
  );

  // 3. Fetch the agency tied to that user
  const agency = useLiveQuery(
    () => (userProfile?.agencyId ? db.agencies.get(userProfile.agencyId) : undefined),
    [userProfile?.agencyId]
  );

  // 4. Default fallback while loading or if data is missing
  if (!agency) {
    return { 
      isPremium: false, 
      plan: 'trial', 
      daysLeft: 0, 
      isExpired: false, 
      maxAgents: 2 
    };
  }

  // 5. Calculate status based on the agency data
  const isPremium = agency.subscriptionPlan === 'pro' || agency.subscriptionPlan === 'enterprise';
  let daysLeft = 0;
  let isExpired = false;

  // Check if an explicit expiry date was set in Firebase
  if (agency.subscriptionExpiresAt) {
    const expiryDate = new Date(agency.subscriptionExpiresAt);
    const diffTime = expiryDate.getTime() - new Date().getTime();
    
    // Math.ceil rounds up so 1.5 days shows as 2 days left
    daysLeft = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    isExpired = daysLeft <= 0;
    
  } else if (agency.subscriptionPlan === 'trial') {
    // Fallback: If no explicit expiry date, calculate 7 days from the agency's creation date
    const created = new Date(agency.createdAt);
    const diffTime = new Date().getTime() - created.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    daysLeft = Math.max(0, 7 - diffDays);
    isExpired = daysLeft <= 0;
  }

  return {
    isPremium,
    plan: agency.subscriptionPlan,
    daysLeft,
    isExpired,
    maxAgents: agency.maxAgentsAllowed || (agency.subscriptionPlan === 'trial' ? 2 : 10)
  };
}