// src/screens/Admin/LiveMapScreen.tsx
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { auth, rtdb, rtdbRef, onValue, off } from '../../lib/firebase';
import { MapPin, Battery, Clock, Navigation, Map as MapIcon, ExternalLink } from 'lucide-react';

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

// Sub-component to fetch and display the human-readable address dynamically
const AddressResolver = ({ lat, lng }: { lat: number; lng: number }) => {
  const [address, setAddress] = useState<string>('Resolving location...');

  useEffect(() => {
    const getAddress = async () => {
      try {
        // Using OpenStreetMap's free Nominatim API for reverse geocoding
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        
        if (data && data.display_name) {
          // Extract the most relevant parts of the address (e.g., street, city, state)
          const addressParts = data.display_name.split(', ');
          // Slice the first 3-4 segments so it doesn't take up the whole screen
          setAddress(addressParts.slice(0, 4).join(', '));
        } else {
          setAddress('Unknown Location Area');
        }
      } catch (error) {
        setAddress('Location details unavailable');
      }
    };

    getAddress();
  }, [lat, lng]);

  return (
    <div className="flex items-start gap-2 mt-2">
      <MapIcon size={14} className="text-emerald-500 mt-0.5 shrink-0" />
      <span className="text-xs text-slate-600 leading-tight">{address}</span>
    </div>
  );
};

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
        
        // Auto-center map to the first agent if we just loaded the screen
        if (parsedLocations.length > 0 && locations.length === 0) {
            setCenter([parsedLocations[0].lat, parsedLocations[0].lng]);
        }
      } else {
        setLocations([]);
      }
    });

    return () => off(locationsRef);
  }, [locations.length]);

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
          <p className="text-sm text-slate-500 font-medium">Active Field Agents: {locations.length}</p>
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
                <div className="min-w-55 p-1">
                  
                  {/* Header: Name and Battery */}
                  <h3 className="font-bold text-slate-800 mb-2 border-b border-slate-200 pb-2 flex items-center justify-between">
                    {loc.name}
                    {loc.battery !== null && (
                      <span className="flex items-center gap-1 text-xs font-normal text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                        <Battery size={12} className={loc.battery < 20 ? "text-red-500" : "text-green-500"} />
                        {loc.battery}%
                      </span>
                    )}
                  </h3>
                  
                  {/* Body: Coordinates, Location Name, Timestamp */}
                  <div className="space-y-2.5 mb-4">
                    {/* Coordinates */}
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Navigation size={14} className="text-purple-500 shrink-0" />
                      <span className="text-[11px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 border border-slate-200">
                        {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                      </span>
                    </div>

                    {/* Dynamic Address Resolver Component */}
                    <AddressResolver lat={loc.lat} lng={loc.lng} />

                    {/* Last Updated Timestamp */}
                    <div className="flex items-center gap-2 text-sm text-slate-600 pt-1">
                      <Clock size={14} className="text-blue-500 shrink-0" />
                      <span className="text-xs font-medium">Updated: {formatTime(loc.timestamp)}</span>
                    </div>
                  </div>

                  {/* Action Button: Deep Link to Google Maps */}
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 bg-brand-50 text-brand-700 border border-brand-200 py-2 rounded-lg text-xs font-bold hover:bg-brand-100 transition active:scale-95 shadow-sm"
                  >
                    Open in Google Maps <ExternalLink size={14} />
                  </a>

                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}