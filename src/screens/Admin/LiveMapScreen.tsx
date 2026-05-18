// src/screens/Admin/LiveMapScreen.tsx
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { auth, rtdb, rtdbRef, onValue, off } from '../../lib/firebase';
import { MapPin, Battery, Clock } from 'lucide-react';

// Fix for default marker icons in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface AgentLocation {
  id: string;
  lat: number;
  lng: number;
  timestamp: number;
  battery: number | null;
  name: string;
}

export default function LiveMapScreen() {
  const [locations, setLocations] = useState<AgentLocation[]>([]);
  const [center, setCenter] = useState<[number, number]>([22.5645, 72.9289]); // Anand, Gujarat Default

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Listen to locations/{agencyId}
    const locationsRef = rtdbRef(rtdb, `locations/${user.uid}`);
    
    onValue(locationsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const parsedLocations = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setLocations(parsedLocations);
        
        // Auto-center map to the first agent if we have agents
        if (parsedLocations.length > 0) {
            setCenter([parsedLocations[0].lat, parsedLocations[0].lng]);
        }
      } else {
        setLocations([]);
      }
    });

    return () => off(locationsRef);
  }, []);

  const formatTime = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000 / 60); // minutes
    if (diff < 1) return 'Just now';
    return `${diff} min ago`;
  };

  return (
    <div className="h-[calc(100vh-64px)] w-full flex flex-col relative">
      <div className="bg-white px-6 py-4 shadow-sm z-10 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <MapPin className="text-brand-600" /> Live Agent Tracking
          </h1>
          <p className="text-sm text-slate-500">Active Field Agents: {locations.length}</p>
        </div>
      </div>
      
      <div className="flex-1 w-full relative z-0">
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {locations.map((loc) => (
            <Marker key={loc.id} position={[loc.lat, loc.lng]}>
              <Popup>
                <div className="min-w-37.5">
                  <h3 className="font-bold text-slate-800 mb-2 border-b pb-1">{loc.name}</h3>
                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-blue-500" />
                      <span>Updated: {formatTime(loc.timestamp)}</span>
                    </div>
                    {loc.battery !== null && (
                      <div className="flex items-center gap-2">
                        <Battery size={14} className={loc.battery < 20 ? "text-red-500" : "text-green-500"} />
                        <span>Battery: {loc.battery}%</span>
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}