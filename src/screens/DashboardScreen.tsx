import { useEffect, useState, ReactNode } from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  FileUp, 
  Play, 
  Clock, 
  ChevronRight,
  IndianRupee,
  Bell
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { auth, db, collection, query, where, getDocs, limit, onSnapshot } from '../lib/firebase';
import { formatCurrency, cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function DashboardScreen() {
  const [stats, setStats] = useState({
    todayDue: 0,
    pendingFollowups: 0,
    completedToday: 0,
    totalCollected: 0,
    totalPending: 0,
    missed: 0
  });

  const [recentCustomers, setRecentCustomers] = useState<any[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Listen to customers for real-time stats
    const qCustomers = query(collection(db, 'customers'), where('assignedAgentId', '==', auth.currentUser.uid));
    const unsubCustomers = onSnapshot(qCustomers, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      const newStats = docs.reduce((acc, doc) => {
        const received = Number(doc.receivedAmount) || 0;
        const due = Number(doc.dueAmount) || 0;
        const status = doc.status?.toLowerCase();
        
        acc.totalCollected += received;

        if (status === 'pending' || !status) {
          acc.todayDue += 1;
          acc.totalPending += due;
        } else if (status === 'full payment') {
          acc.completedToday += 1;
        } else if (status === 'partial payment' || status === 'promise to pay') {
          acc.totalPending += due;
        }
        
        return acc;
      }, {
        todayDue: 0,
        pendingFollowups: 0,
        completedToday: 0,
        totalCollected: 0,
        totalPending: 0,
        missed: 0
      });

      setStats(prev => ({ ...prev, ...newStats }));
      setRecentCustomers(docs.filter(d => d.status !== 'Full Payment').slice(0, 3));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers_stats');
    });

    // Listen to followups for today
    const todayStr = new Date().toISOString().split('T')[0];
    const qFollowups = query(
      collection(db, 'followups'), 
      where('agentId', '==', auth.currentUser.uid),
      where('completed', '==', false)
    );
    const unsubFollowups = onSnapshot(qFollowups, (snap) => {
      const docs = snap.docs.map(d => d.data());
      const todayFollowups = docs.filter(f => f.scheduledAt && f.scheduledAt.startsWith(todayStr)).length;
      setStats(prev => ({ ...prev, pendingFollowups: todayFollowups }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'followups_stats');
    });

    return () => {
      unsubCustomers();
      unsubFollowups();
    };
  }, [auth.currentUser]);

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hello, {auth.currentUser?.displayName?.split(' ')[0]}</h1>
          <p className="text-sm text-slate-500 font-medium">Ready for today's collection?</p>
        </div>
        <Link to="/notifications" className="relative w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-600 android-shadow">
          <Bell size={24} />
          <span className="absolute top-3 right-3 w-3 h-3 bg-red-500 border-2 border-white rounded-full" />
        </Link>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard 
          label="Today's Due" 
          value={stats.todayDue} 
          icon={<IndianRupee className="text-brand-600" />} 
          color="bg-brand-50"
        />
        <Link to="/followups">
          <StatCard 
            label="Follow-ups" 
            value={stats.pendingFollowups} 
            icon={<Clock className="text-orange-600" />} 
            color="bg-orange-50"
          />
        </Link>
      </div>

      {/* Performance Summary Card */}
      <div className="bg-brand-900 rounded-3xl p-6 text-white overflow-hidden relative shadow-xl shadow-brand-100">
        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-brand-300 text-xs font-bold uppercase tracking-widest">Today's Progress</span>
            <div className="flex items-center space-x-1 text-emerald-400 bg-white/10 px-2 py-1 rounded-lg">
              <TrendingUp size={12} />
              <span className="text-[10px] font-bold">+12%</span>
            </div>
          </div>
          
          <div className="space-y-1">
            <h3 className="text-3xl font-bold">{formatCurrency(stats.totalCollected)}</h3>
            <p className="text-brand-300 text-xs font-medium">Collected out of {formatCurrency(stats.totalCollected + stats.totalPending)}</p>
          </div>

          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: stats.totalCollected > 0 ? `${Math.min(100, (stats.totalCollected / (stats.totalCollected + stats.totalPending || 1)) * 100)}%` : "0%" }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
            />
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-brand-800 rounded-full blur-3xl opacity-50" />
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <ActionBtn to="/import" icon={<FileUp size={24} />} label="Upload PDF" />
        <ActionBtn to="/customers" icon={<Play size={24} />} label="Start Visit" primary />
        <ActionBtn to="/followups" icon={<Calendar size={24} />} label="Follow-ups" />
        <ActionBtn to="/reports" icon={<TrendingUp size={24} />} label="Reports" />
      </div>

      {/* Quick Status Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Priority Collections</h2>
          <Link to="/customers" className="text-brand-600 text-sm font-bold">View All</Link>
        </div>
        
        <div className="space-y-3">
          {recentCustomers.length > 0 ? recentCustomers.map((cust) => (
            <Link key={cust.id} to={`/customers/${cust.id}`} className="premium-card p-4 flex items-center space-x-4 active:scale-[0.98] transition-transform">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold uppercase">
                {cust.name ? cust.name[0] : '?'}
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-slate-900">{cust.name}</h4>
                <p className="text-xs text-slate-500 font-medium">Loan ID: {cust.loanId}</p>
              </div>
              <div className="text-right">
                <div className="font-bold text-slate-900">{formatCurrency(cust.dueAmount || 0)}</div>
                <div className={cn(
                  "text-[10px] font-bold uppercase",
                  cust.status === 'Full Payment' ? "text-emerald-500" : "text-brand-600"
                )}>
                  {cust.status || 'Pending'}
                </div>
              </div>
            </Link>
          )) : (
            <div className="text-center py-10 space-y-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                <AlertCircle size={32} />
              </div>
              <p className="text-sm text-slate-400 font-medium">No active collections yet.</p>
              <Link to="/import" className="text-brand-600 text-sm font-bold">Import list to start</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number | string; icon: ReactNode; color: string }) {
  return (
    <div className="premium-card p-4 space-y-3">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{label}</p>
        <h3 className="text-xl font-bold">{value}</h3>
      </div>
    </div>
  );
}

function ActionBtn({ to, icon, label, primary }: { to: string, icon: ReactNode; label: string; primary?: boolean }) {
  return (
    <Link 
      to={to}
      className={cn(
        "flex flex-col items-center justify-center p-6 rounded-4xl space-y-3 transition-all active:scale-95 android-shadow border",
        primary ? "bg-brand-600 text-white border-brand-500 shadow-lg shadow-brand-200" : "bg-white text-slate-700 border-slate-100"
      )}
    >
      {icon}
      <span className="font-bold text-xs uppercase tracking-tight">{label}</span>
    </Link>
  );
}
