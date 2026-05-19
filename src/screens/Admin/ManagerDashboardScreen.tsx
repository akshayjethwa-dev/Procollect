// src/screens/Admin/ManagerDashboardScreen.tsx
import { useEffect, useState } from 'react';
import { 
  Users, 
  Wallet, 
  TrendingUp, 
  Briefcase,
  ChevronRight,
  Activity,
  AlertTriangle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { auth, db, collection, query, where, onSnapshot, doc, getDoc } from '../../lib/firebase';
import { formatCurrency } from '../../lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function ManagerDashboardScreen() {
  const [agentsCount, setAgentsCount] = useState(0);
  const [pendingCash, setPendingCash] = useState(0);
  const [todaysRecovery, setTodaysRecovery] = useState(0);
  const [campaignsCount, setCampaignsCount] = useState(0);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [setupWarning, setSetupWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    const currentUid = auth.currentUser.uid;
    
    let unsubAgents: (() => void) | undefined;
    let unsubDeposits: (() => void) | undefined;
    let unsubCampaigns: (() => void) | undefined;
    let unsubInteractions: (() => void) | undefined;
    
    // Fetch the manager's profile
    getDoc(doc(db, 'users', currentUid)).then((docSnap) => {
      if (docSnap.exists()) {
        let agencyId = docSnap.data().agencyId;
        
        // SECURITY / AUTO-FIX: If missing, fallback to Manager's UID to prevent total lock-out during testing.
        if (!agencyId) {
          agencyId = currentUid;
          setSetupWarning(`No 'agencyId' found in your profile. Using your UID (${agencyId}) as the default Agency ID. Please ensure your field agents have this exact 'agencyId' in their Firestore documents.`);
        } else {
          setSetupWarning(null); // Clear warning if agencyId exists
        }

        // Helper function: STRICTLY filter by this manager's assigned agencyId
        const getAgencyQuery = (colName: string) => {
          return query(collection(db, colName), where('agencyId', '==', agencyId));
        };

        // 1. Total Field Agents (Belonging ONLY to this agency)
        unsubAgents = onSnapshot(
          getAgencyQuery('users'),
          (snap) => {
            const fieldAgents = snap.docs.filter(d => {
              const role = d.data().role;
              return role !== 'agency_manager' && role !== 'admin';
            });
            setAgentsCount(fieldAgents.length);
          },
          (error) => console.error("Error fetching agents:", error)
        );

        // 2. Cash Pending Approval (Belonging ONLY to this agency)
        unsubDeposits = onSnapshot(
          getAgencyQuery('cashDeposits'),
          (snap) => {
            let sum = 0;
            snap.docs.forEach(d => {
              if (d.data().status === 'pending') {
                sum += Number(d.data().amount || 0);
              }
            });
            setPendingCash(sum);
          },
          (error) => console.error("Error fetching deposits:", error)
        );

        // 3. Total Active Campaigns (Belonging ONLY to this agency)
        // FIX: Changed 'batchImports' to 'batches' to match firestore.rules
        unsubCampaigns = onSnapshot(
          getAgencyQuery('batches'),
          (snap) => setCampaignsCount(snap.size),
          (error) => console.error("Error fetching campaigns:", error)
        );

        // 4. Today's Total Recovery & 7-Day Chart (Belonging ONLY to this agency)
        unsubInteractions = onSnapshot(
          getAgencyQuery('interactions'),
          (snap) => {
            let todaySum = 0;
            const todayStr = new Date().toISOString().split('T')[0];
            
            const dayMap: Record<string, number> = {};
            for (let i = 6; i >= 0; i--) {
              const d = new Date();
              d.setDate(d.getDate() - i);
              dayMap[d.toISOString().split('T')[0]] = 0;
            }

            snap.docs.forEach(d => {
              const data = d.data();
              if (data.type !== 'payment' || !data.timestamp) return;
              
              const dateStr = data.timestamp.split('T')[0];
              const amount = Number(data.amount || 0);

              if (dateStr === todayStr) {
                todaySum += amount;
              }

              if (dayMap[dateStr] !== undefined) {
                dayMap[dateStr] += amount;
              }
            });

            setTodaysRecovery(todaySum);
            
            const chartData = Object.keys(dayMap).map(date => {
              const d = new Date(date);
              return {
                name: d.toLocaleDateString('en-US', { weekday: 'short' }),
                amount: dayMap[date]
              };
            });
            
            setWeeklyData(chartData);
          },
          (error) => console.error("Error fetching interactions:", error)
        );
      }
    }).catch(err => console.error("Error getting manager profile:", err));

    return () => {
      if (unsubAgents) unsubAgents();
      if (unsubDeposits) unsubDeposits();
      if (unsubCampaigns) unsubCampaigns();
      if (unsubInteractions) unsubInteractions();
    };
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Agency Overview</h1>
        <p className="text-slate-500 mt-1 font-medium">Real-time metrics for your collection agency.</p>
      </div>

      {/* Dynamic Setup Warning for Developers */}
      {setupWarning && (
        <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex items-start gap-3 text-orange-800">
          <AlertTriangle className="shrink-0 mt-0.5 text-orange-500" size={20} />
          <div>
            <h3 className="font-bold text-sm">Database Setup Notice</h3>
            <p className="text-xs mt-1 font-medium opacity-90">{setupWarning}</p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Active Campaigns */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-32">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <Briefcase size={20} />
            </div>
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Active Campaigns</p>
            <h3 className="text-2xl font-black text-slate-900 leading-none mt-1">{campaignsCount}</h3>
          </div>
        </div>

        {/* Field Agents */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-32">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <Users size={20} />
            </div>
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Field Agents</p>
            <h3 className="text-2xl font-black text-slate-900 leading-none mt-1">{agentsCount}</h3>
          </div>
        </div>

        {/* Today's Recovery */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-32">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <TrendingUp size={20} />
            </div>
            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-md flex items-center gap-1">
               <Activity size={12} /> Live
            </span>
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Today's Recovery</p>
            <h3 className="text-2xl font-black text-slate-900 leading-none mt-1">{formatCurrency(todaysRecovery)}</h3>
          </div>
        </div>

        {/* Cash Pending Approval */}
        <Link to="/admin/deposits" className="block h-32 active:scale-95 transition-transform">
          <div className="bg-brand-600 p-5 rounded-2xl shadow-md border border-brand-500 flex flex-col justify-between h-full text-white">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white">
                <Wallet size={20} />
              </div>
              <ChevronRight size={18} className="text-brand-200" />
            </div>
            <div>
              <p className="text-[11px] text-brand-200 font-bold uppercase tracking-wider">Cash Pending Approval</p>
              <h3 className="text-2xl font-black text-white leading-none mt-1">{formatCurrency(pendingCash)}</h3>
            </div>
          </div>
        </Link>
      </div>

      {/* 7-Day Recovery Chart */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-lg font-bold text-slate-800 mb-6">Recovery Last 7 Days</h2>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `₹${val}`} />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }} 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: any) => [formatCurrency(Number(value) || 0), 'Recovered']}
              />
              <Bar dataKey="amount" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}