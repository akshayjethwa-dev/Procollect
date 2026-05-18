// src/components/GeoTracker.tsx
import { useEffect, useRef } from 'react';
import { auth, rtdb, rtdbRef, set, getUserAgencyId } from '../lib/firebase';

export default function GeoTracker() {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const startTracking = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const agencyId = await getUserAgencyId();
      if (!agencyId) return;

      // Function to get battery level
      const getBatteryLevel = async () => {
        try {
          // @ts-ignore - Battery API is not standard in all TS DOM libs
          if (navigator.getBattery) {
            // @ts-ignore
            const battery = await navigator.getBattery();
            return Math.round(battery.level * 100);
          }
        } catch (e) {
          console.warn("Battery API not supported");
        }
        return null;
      };

      const pushLocation = () => {
        if (!navigator.geolocation) return;

        navigator.geolocation.getCurrentPosition(async (position) => {
          const { latitude, longitude } = position.coords;
          const battery = await getBatteryLevel();
          
          const locationData = {
            lat: latitude,
            lng: longitude,
            timestamp: Date.now(),
            battery: battery,
            name: user.displayName || 'Unknown Agent'
          };

          // Write to RTDB: locations/{agencyId}/{agentId}
          set(rtdbRef(rtdb, `locations/${agencyId}/${user.uid}`), locationData)
            .catch(err => console.error("Error updating location:", err));
        }, (error) => {
          console.error("Location error:", error.message);
        }, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      };

      // Push immediately on load
      pushLocation();
      
      // Throttle to every 2 minutes (120,000 ms) to save battery
      timerRef.current = setInterval(pushLocation, 120000);
    };

    startTracking();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return null; // Silent background component
}