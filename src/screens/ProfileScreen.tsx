import { auth, db, doc, getDoc, signOut, updateDoc } from '../lib/firebase';
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
  BadgeCheck,
  Pencil,
  Save,
  X,
  AlertCircle
} from 'lucide-react';
import { useEffect, useState, ReactNode } from 'react';
import { useTrialStatus } from '../lib/useTrialStatus';

export default function ProfileScreen() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState<any>(null);
  
  // Trial Status Hook
  const { isExpired, daysLeft } = useTrialStatus();
  
  // Edit Profile States
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    companyName: '',
    phone: '',
    gender: 'Not Specified'
  });

  useEffect(() => {
    if (auth.currentUser) {
      getDoc(doc(db, 'users', auth.currentUser.uid)).then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          setUserData(data);
          setEditForm({
            name: data.name || '',
            companyName: data.companyName || '',
            phone: data.phone || '',
            gender: data.gender || 'Not Specified'
          });
        }
      });
    }
  }, [auth.currentUser]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const handleSaveProfile = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        name: editForm.name,
        companyName: editForm.companyName,
        phone: editForm.phone,
        gender: editForm.gender,
        updatedAt: new Date().toISOString()
      });
      
      setUserData((prev: any) => ({ ...prev, ...editForm }));
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-8 pb-24">
      {/* Profile Header */}
      <div className="text-center space-y-4">
        <div className="relative inline-block">
          <div className="w-24 h-24 bg-brand-600 rounded-4xl flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-brand-100">
            {userData?.name ? userData.name[0].toUpperCase() : <User size={48} />}
          </div>
          <div className="absolute -bottom-1 -right-1 bg-emerald-500 border-4 border-slate-50 w-8 h-8 rounded-full flex items-center justify-center text-white">
            <BadgeCheck size={14} />
          </div>
        </div>
        
        {!isEditing ? (
          <div>
            <h1 className="text-2xl font-black text-slate-900">{userData?.name || 'Agent Pro'}</h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em]">{userData?.companyName || 'Add Organization'}</p>
            {userData?.phone && <p className="text-sm text-slate-500 mt-1">{userData.phone}</p>}
            
            <button 
              onClick={() => setIsEditing(true)}
              className="mt-4 inline-flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider active:bg-slate-200 transition-colors"
            >
              <Pencil size={14} />
              <span>Edit Profile</span>
            </button>
          </div>
        ) : (
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4 text-left mt-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-black text-slate-800">Edit Details</h3>
              <button onClick={() => setIsEditing(false)} className="text-slate-400 p-1">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Full Name</label>
                <input 
                  type="text" 
                  value={editForm.name}
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="e.g. Rahul Sharma"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Organization Name</label>
                <input 
                  type="text" 
                  value={editForm.companyName}
                  onChange={(e) => setEditForm({...editForm, companyName: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="e.g. Diamond Finance Ltd."
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Phone Number</label>
                <input 
                  type="tel" 
                  value={editForm.phone}
                  onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="+91 98765 43210"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Gender</label>
                <select 
                  value={editForm.gender}
                  onChange={(e) => setEditForm({...editForm, gender: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="Not Specified">Not Specified</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <button 
                onClick={handleSaveProfile}
                disabled={saving}
                className="w-full mt-2 bg-brand-600 text-white rounded-xl px-4 py-3 font-bold flex items-center justify-center space-x-2 disabled:opacity-70"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save size={18} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Membership Banner */}
      {!isEditing && (
        <Link to="/membership" className={`premium-card p-5 flex items-center justify-between group overflow-hidden relative active:scale-[0.98] transition-transform mt-6 ${isExpired ? 'bg-red-50 border-red-100' : 'bg-brand-50 border-brand-100'}`}>
          <div className={`absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 rounded-full blur-2xl ${isExpired ? 'bg-red-200/30' : 'bg-brand-200/20'}`} />
          <div className="flex items-center space-x-4 relative z-10">
            <div className={`w-12 h-12 text-white rounded-2xl flex items-center justify-center shadow-lg ${isExpired ? 'bg-red-500' : 'bg-brand-600'}`}>
              {isExpired ? <AlertCircle size={24} /> : <Crown size={24} />}
            </div>
            <div>
              <h3 className={`font-black text-sm ${isExpired ? 'text-red-900' : 'text-brand-900'}`}>
                {isExpired ? 'Trial Expired' : 'Free Trial Active'}
              </h3>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${isExpired ? 'text-red-600' : 'text-brand-600'}`}>
                {isExpired ? 'Upgrade to Pro' : `${daysLeft} days remaining`}
              </p>
            </div>
          </div>
          <div className={`text-white p-2 rounded-xl group-hover:px-4 duration-300 transition-all flex items-center space-x-2 ${isExpired ? 'bg-red-500' : 'bg-brand-600'}`}>
            <span className="text-[10px] font-bold uppercase tracking-tight hidden group-hover:inline">Upgrade</span>
            <ChevronRight size={20} />
          </div>
        </Link>
      )}

      {/* Menu Categories */}
      {!isEditing && (
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

          <button 
            onClick={handleLogout}
            className="w-full premium-card p-5 flex items-center justify-center space-x-3 text-red-500 font-bold active:bg-red-50 transition-colors"
          >
            <LogOut size={20} />
            <span>Log Out Securely</span>
          </button>
        </div>
      )}

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