import { auth, db, doc, getDoc, signOut } from '../lib/firebase';
import { useNavigate, Link } from 'react-router-dom';
import { 
  User, 
  Settings, 
  HelpCircle, 
  LogOut, 
  ChevronRight, 
  Crown, 
  Languages, 
  Bell, 
  Shield, 
  BadgeCheck 
} from 'lucide-react';
import { useEffect, useState, ReactNode } from 'react';

export default function ProfileScreen() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    if (auth.currentUser) {
      getDoc(doc(db, 'users', auth.currentUser.uid)).then(snap => {
        if (snap.exists()) setUserData(snap.data());
      });
    }
  }, [auth.currentUser]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <div className="p-6 space-y-8">
      {/* Profile Header */}
      <div className="text-center space-y-4">
        <div className="relative inline-block">
          <div className="w-24 h-24 bg-brand-600 rounded-[2rem] flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-brand-100">
            {userData?.name ? userData.name[0] : <User size={48} />}
          </div>
          <div className="absolute -bottom-1 -right-1 bg-emerald-500 border-4 border-slate-50 w-8 h-8 rounded-full flex items-center justify-center text-white">
            <BadgeCheck size={14} />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900">{userData?.name || 'Agent Pro'}</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em]">{userData?.companyName || 'Diamond Finance Ltd.'}</p>
        </div>
      </div>

      {/* Membership Banner */}
      <Link to="/membership" className="premium-card bg-brand-50 border-brand-100 p-5 flex items-center justify-between group overflow-hidden relative active:scale-[0.98] transition-transform">
        <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-brand-200/20 rounded-full blur-2xl" />
        <div className="flex items-center space-x-4 relative z-10">
          <div className="w-12 h-12 bg-brand-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
            <Crown size={24} />
          </div>
          <div>
            <h3 className="font-black text-brand-900 text-sm">Free Trial Active</h3>
            <p className="text-[10px] text-brand-600 font-bold uppercase tracking-wider">6 days remaining</p>
          </div>
        </div>
        <div className="bg-brand-600 text-white p-2 rounded-xl group-hover:px-4 duration-300 transition-all flex items-center space-x-2">
          <span className="text-[10px] font-bold uppercase tracking-tight hidden group-hover:inline">Upgrade</span>
          <ChevronRight size={20} />
        </div>
      </Link>

      {/* Menu Categories */}
      <div className="space-y-6">
        <MenuSection title="Account Settings">
          <MenuItem icon={<Settings size={20} />} label="Agent Settings" desc="Personal tools & preferences" />
          <MenuItem icon={<Languages size={20} />} label="App Language" desc="Default: English (IN)" />
          <MenuItem icon={<Bell size={20} />} label="Notifications" desc="Follow-ups, alerts & summaries" />
        </MenuSection>

        <MenuSection title="Support & Safety">
          <MenuItem icon={<HelpCircle size={20} />} label="Help Center" desc="Guides, FAQs & Live Support" />
          <MenuItem icon={<Shield size={20} />} label="Security" desc="Biometrics & PIN lock" />
        </MenuSection>
      </div>

      <button 
        onClick={handleLogout}
        className="w-full premium-card p-5 flex items-center justify-center space-x-3 text-red-500 font-bold active:bg-red-50 transition-colors"
      >
        <LogOut size={20} />
        <span>Log Out Securely</span>
      </button>

      <div className="text-center py-4">
        <p className="text-[10px] text-slate-300 font-bold uppercase tracking-[0.3em]">ProCollect v4.2.0-F</p>
      </div>
    </div>
  );
}

function MenuSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">{title}</h3>
      <div className="premium-card overflow-hidden divide-y divide-slate-50">
        {children}
      </div>
    </div>
  );
}

function MenuItem({ icon, label, desc }: { icon: ReactNode; label: string; desc: string }) {
  return (
    <button className="w-full p-4 flex items-center justify-between active:bg-slate-50 transition-colors">
      <div className="flex items-center space-x-4">
        <div className="text-slate-400">{icon}</div>
        <div className="text-left">
          <h4 className="font-bold text-slate-900 text-sm">{label}</h4>
          <p className="text-[10px] text-slate-400 font-medium">{desc}</p>
        </div>
      </div>
      <ChevronRight size={18} className="text-slate-300" />
    </button>
  );
}
