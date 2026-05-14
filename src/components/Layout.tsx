import { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Home, Users, BarChart3, User, PlusCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Layout() {
  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-slate-50 relative overflow-hidden">
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
