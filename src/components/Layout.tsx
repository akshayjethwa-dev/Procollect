// src/components/Layout.tsx
import { ReactNode } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { Home, Users, BarChart3, User, PlusCircle, Shield } from 'lucide-react';
import { cn } from '../lib/utils';
import GeoTracker from './GeoTracker';

// Accept userRole as a prop
export default function Layout({ userRole }: { userRole?: string | null }) {
  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-slate-50 relative overflow-hidden">
      {/* Background Geolocation Tracker */}
      <GeoTracker />
      
      {/* NEW: Top banner for Independent Agents to switch back to Admin */}
      {userRole === 'independent_agent' && (
        <div className="bg-slate-900 text-white px-4 py-2.5 flex justify-between items-center z-40 relative shadow-md">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-blue-400" />
            <span className="text-xs font-semibold text-slate-300">Independent Mode</span>
          </div>
          <Link 
            to="/admin/dashboard" 
            className="text-xs bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-md font-medium transition-colors shadow-sm"
          >
            Manager Portal →
          </Link>
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-100 flex items-center h-16 px-2 z-50">
        <div className="flex-1 flex justify-center">
          <NavItem to="/dashboard" icon={<Home size={24} />} label="Home" />
        </div>
        <div className="flex-1 flex justify-center">
          <NavItem to="/customers" icon={<Users size={24} />} label="List" />
        </div>
        
        <div className="flex-1 flex justify-center -mt-10">
          <NavLink 
            to="/import" 
            className={({ isActive }) => cn(
              "w-14 h-14 rounded-full shadow-lg border-4 border-slate-50 flex items-center justify-center transition-all active:scale-95",
              isActive ? "bg-brand-700" : "bg-brand-600"
            )}
          >
            <PlusCircle size={32} className="text-white" />
          </NavLink>
        </div>

        <div className="flex-1 flex justify-center">
          <NavItem to="/reports" icon={<BarChart3 size={24} />} label="Reports" />
        </div>
        <div className="flex-1 flex justify-center">
          <NavItem to="/profile" icon={<User size={24} />} label="Profile" />
        </div>
      </nav>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex flex-col items-center justify-center space-y-1 transition-colors",
          isActive ? "text-brand-600" : "text-slate-400"
        )
      }
    >
      {icon}
      <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
    </NavLink>
  );
}