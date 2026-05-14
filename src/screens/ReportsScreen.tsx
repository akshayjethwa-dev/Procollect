import { useEffect, useState, ReactNode } from 'react';
import { BarChart3, TrendingUp, PieChart, Download, Calendar } from 'lucide-react';
import { auth, db, collection, query, where, onSnapshot } from '../lib/firebase';
import { formatCurrency } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function ReportsScreen() {
  const [stats, setStats] = useState({
    totalRecovery: 0,
    visitCount: 0,
    efficiency: 0,
    trendData: [0, 0, 0, 0, 0, 0, 0]
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, 'interactions'), where('agentId', '==', auth.currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => d.data());
      
      const totalRecovery = docs.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
      const visitCount = docs.length;
      
      // Calculate efficiency (e.g. % of interactions that resulted in payment)
      const payments = docs.filter(d => d.type === 'payment').length;
      const efficiency = visitCount > 0 ? Math.round((payments / visitCount) * 100) : 0;

      setStats({
        totalRecovery,
        visitCount,
        efficiency,
        trendData: [40, 70, 45, 90, 65, 80, 55] // Keep some mock for trend for now or just 0s
      });
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'interactions_reports');
    });

    return unsub;
  }, [auth.currentUser]);

  if (loading) return <div className="p-8 text-center text-slate-400">Loading reports...</div>;

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Performance</h1>
        <button className="bg-white p-3 rounded-2xl android-shadow border border-slate-100 flex items-center space-x-2 text-xs font-bold text-slate-600">
          <Calendar size={16} />
          <span>My Stats</span>
        </button>
      </div>

      {/* Summary Stats */}
      <div className="premium-card bg-emerald-500 p-6 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-emerald-100 text-[10px] font-bold uppercase tracking-widest">Your Recovery</p>
            <h2 className="text-3xl font-black">{formatCurrency(stats.totalRecovery)}</h2>
          </div>
          <div className="bg-white/20 p-4 rounded-[2rem]">
            <TrendingUp size={32} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatItem label="Visit Count" value={stats.visitCount.toString()} icon={<BarChart3 size={20} />} />
        <StatItem label="Efficiency" value={`${stats.efficiency}%`} icon={<PieChart size={20} />} />
      </div>

      {/* Placeholder Chart */}
      <div className="space-y-4">
        <h3 className="font-bold">Collection Trend</h3>
        <div className="premium-card p-6 h-48 flex items-end justify-between bg-slate-50 border-dashed">
          {[40, 70, 45, 90, 65, 80, 55].map((h, i) => (
            <div key={i} className="w-8 rounded-t-xl bg-brand-600 transition-all hover:bg-brand-500 cursor-pointer" style={{ height: `${h}%` }}>
              <div className="w-full h-1 bg-white/30 rounded-t-xl" />
            </div>
          ))}
        </div>
        <div className="flex justify-between px-2 text-[10px] font-bold text-slate-400">
          <span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span>
        </div>
      </div>

      <button className="w-full premium-card p-5 border-brand-100 text-brand-600 font-bold flex items-center justify-center space-x-2 active:bg-brand-50 transition-colors">
        <Download size={20} />
        <span>Download PDF Report</span>
      </button>
    </div>
  );
}

function StatItem({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="premium-card p-4 space-y-3">
      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
        {icon}
      </div>
      <div>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{label}</p>
        <p className="text-lg font-black text-slate-900">{value}</p>
      </div>
    </div>
  );
}
