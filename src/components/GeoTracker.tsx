import { useEffect, useRef, useState } from 'react';
import { auth, rtdb, rtdbRef, set, getUserAgencyId } from '../lib/firebase';

export default function GeoTracker() {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const startTracking = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const agencyId = await getUserAgencyId();
      if (!agencyId) {
        console.error("GeoTracker: Could not determine agencyId.");
        return;
      }

      const getBatteryLevel = async () => {
        try {
          // @ts-ignore
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
        if (!navigator.geolocation) {
          setErrorMsg("Geolocation is not supported by your browser.");
          return;
        }

        // This automatically triggers the browser's "Allow Location" popup
        navigator.geolocation.getCurrentPosition(async (position) => {
          setErrorMsg(null); // Clear errors if successful
          const { latitude, longitude } = position.coords;
          const battery = await getBatteryLevel();
          
          const locationData = {
            lat: latitude,
            lng: longitude,
            timestamp: Date.now(),
            battery: battery,
            name: user.displayName || 'Unknown Agent'
          };

          // Save to database
          set(rtdbRef(rtdb, `locations/${agencyId}/${user.uid}`), locationData)
            .catch(err => console.error("Error updating DB:", err));

        }, (error) => {
          console.error("Location error:", error.message);
          if (error.code === error.PERMISSION_DENIED) {
             setErrorMsg("Location access denied! Please allow location permissions in your browser settings to stay active.");
          }
        }, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      };

      // Run immediately
      pushLocation();
      
      // Then run every 2 minutes
      timerRef.current = setInterval(pushLocation, 120000);
    };

    startTracking();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Show a red warning banner if permissions are denied
  if (errorMsg) {
    return (
      <div className="bg-red-500 text-white text-xs font-medium p-2 text-center w-full z-50">
        ⚠️ {errorMsg}
      </div>
    );
  }

  return null; // Silent background component if everything is fine
}