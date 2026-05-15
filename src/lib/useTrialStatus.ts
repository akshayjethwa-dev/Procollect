import { useState, useEffect } from 'react';
import { auth } from './firebase';

export function useTrialStatus() {
  const [daysLeft, setDaysLeft] = useState(0);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const checkStatus = () => {
      // Get the exact time the user signed up
      const creationTime = auth.currentUser?.metadata.creationTime;
      
      if (creationTime) {
        const created = new Date(creationTime);
        const now = new Date();
        
        // Calculate the difference in days
        const diffTime = now.getTime() - created.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const remaining = 7 - diffDays;
        
        if (remaining <= 0) {
          setIsExpired(true);
          setDaysLeft(0);
        } else {
          setIsExpired(false);
          setDaysLeft(remaining);
        }
      }
    };

    checkStatus();
  }, []);

  return { daysLeft, isExpired };
}