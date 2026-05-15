import { useEffect, useState, useMemo, ReactNode } from 'react';
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
  Bell,
  Activity
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { auth, db, collection, query, where, onSnapshot } from '../lib/firebase';
import { formatCurrency, cn, calculateDaysOverdue } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

// Ultra-robust Date Checker (Handles Timezones perfectly by comparing local calendar days)
const isDateInFilter = (dateString: string | undefined, filter: string) => {
  if (!dateString) return false;
  
  const targetDate = new Date(dateString);
  const today = new Date();
  
  // Normalize to purely local midnight dates
  const targetDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const currentDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const diffTime = currentDay.getTime() - targetDay.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (filter === 'today') return diffDays === 0;
  if (filter === 'yesterday') return diffDays === 1;
  if (filter === 'week') return diffDays >= 0 && diffDays <= today.getDay();
  if (filter === 'month') return targetDate.getMonth() === today.getMonth() && targetDate.getFullYear() === today.getFullYear();
  if (filter === 'all') return true;
  
  return false;
};

export default function DashboardScreen() {
  // Raw Data States
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [allInteractions, setAllInteractions] = useState<any[]>([]); 
  
  // UI States
  const [dateFilter, setDateFilter] = useState('today');

  useEffect(() => {
    if (!auth.currentUser) return;
    const agentId = auth.currentUser.uid;

    // Listen to customers (Used for portfolio totals and ageing buckets)
    const qCustomers = query(collection(db, 'customers'), where('assignedAgentId', '==', agentId));
    const unsubCustomers = onSnapshot(qCustomers, (snap) => {
      setAllCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers_stats');
    });

    // Listen to tasks (Used for pending/missed follow-ups)
    const qFollowups = query(
      collection(db, 'followups'), 
      where('agentId', '==', agentId),
      where('completed', '==', false)
    );
    const unsubFollowups = onSnapshot(qFollowups, (snap) => {
      setAllTasks(snap.docs.map(d => d.data()));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'followups_stats');
    });

    // Listen to interactions (Used for highly accurate daily financial collections)
    const qInteractions = query(
      collection(db, 'interactions'),
      where('agentId', '==', agentId)
    );
    const unsubInteractions = onSnapshot(qInteractions, (snap) => {
      setAllInteractions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Failed to fetch interactions:", error);
    });

    return () => {
      unsubCustomers();
      unsubFollowups();
      unsubInteractions();
    };
  }, []);

  // Compute stats dynamically
  const stats = useMemo(() => {
    const result = {
      activeCases: 0,
      totalPending: 0,
      collectedInPeriod: 0,
      visitsInPeriod: 0,
      pendingFollowups: 0,
      missedFollowups: 0,
      overdue0to7: 0,
      overdue8to30: 0,
      overdue30plus: 0
    };

    // 1. Portfolio Totals (This is the CURRENT SNAPSHOT)
    // The "due" amount here is already deducted if they made a payment.
    allCustomers.forEach(doc => {
      const due = Number(doc.totalDueAmount !== undefined ? doc.totalDueAmount : (doc.dueAmount || 0));
      const status = doc.status?.toLowerCase();

      if (status === 'pending' || !status || status === 'partial payment' || status === 'promise to pay') {
        result.totalPending += due;
        result.activeCases += 1;
      }
      
      // Ageing Buckets
      if (status !== 'full payment') {
        const daysOverdue = calculateDaysOverdue(doc.dueDate);
        if (daysOverdue >= 1 && daysOverdue <= 7) result.overdue0to7 += 1;
        else if (daysOverdue >= 8 && daysOverdue <= 30) result.overdue8to30 += 1;
        else if (daysOverdue > 30) result.overdue30plus += 1;
      }
    });

    // 2. Period Collections & Visits 
    if (dateFilter === 'all') {
      // For "All-Time", rely directly on the customer profiles so we don't miss legacy collections
      allCustomers.forEach(doc => {
        const received = Number(doc.totalReceivedAmount !== undefined ? doc.totalReceivedAmount : (doc.receivedAmount || 0));
        result.collectedInPeriod += received;
      });
      result.visitsInPeriod = allInteractions.length;
    } else {
      // For specific dates (Today, Yesterday, Week), rely on precise interaction logs
      allInteractions.forEach(interaction => {
        if (isDateInFilter(interaction.timestamp, dateFilter)) {
          result.visitsInPeriod += 1;
          
          if (interaction.type === 'payment' && interaction.amount) {
            result.collectedInPeriod += Number(interaction.amount);
          }
        }
      });
    }

    // 3. Task Metrics
    const todayStr = new Date().toISOString().split('T')[0];
    allTasks.forEach(f => {
      if (!f.scheduledAt) return;
      const taskDate = f.scheduledAt.split('T')[0];
      
      if (taskDate === todayStr) result.pendingFollowups++;
      if (taskDate < todayStr || (f.rescheduledCount && f.rescheduledCount > 0)) {
        result.missedFollowups++;
      }
    });

    return result;
  }, [allCustomers, allTasks, allInteractions, dateFilter]);

  const recentCustomers = allCustomers.filter(d => d.status !== 'Full Payment').slice(0, 3);

  const getFilterLabel = () => {
    switch(dateFilter) {
      case 'today': return "Collected Today";
      case 'yesterday': return "Collected Yesterday";
      case 'week': return "Collected This Week";
      case 'month': return "Collected This Month";
      case 'all': return "All-Time Collections";
      default: return "Collections";
    }
  };

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hello, {auth.currentUser?.displayName?.split(' ')[0] || 'Agent'}</h1>
          <p className="text-sm text-slate-500 font-medium">Ready for your collections?</p>
        </div>
        <Link to="/notifications" className="relative w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-600 android-shadow">
          <Bell size={24} />
          <span className="absolute top-3 right-3 w-3 h-3 bg-red-500 border-2 border-white rounded-full" />
        </Link>
      </div>

      {/* Date Filter Selection */}
      <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-none mt-2">
        {['today', 'yesterday', 'week', 'month', 'all'].map(f => (
          <button
            key={f}
            onClick={() => setDateFilter(f)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold capitalize whitespace-nowrap transition-all border",
              dateFilter === f 
                ? "bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-100" 
                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
            )}
          >
            {f === 'week' ? 'This Week' : f === 'month' ? 'This Month' : f === 'all' ? 'All Time' : f}
          </button>
        ))}
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard 
          label="Active Cases" 
          value={stats.activeCases} 
          icon={<IndianRupee className="text-brand-600" />} 
          color="bg-brand-50"
        />
        <Link to="/followups">
          <StatCard 
            label="Today's Tasks" 
            value={stats.pendingFollowups} 
            icon={<Clock className="text-orange-600" />} 
            color="bg-orange-50"
          />
        </Link>

        {/* Rescheduled/Missed Follow-up Warning Card */}
        {stats.missedFollowups > 0 && (
          <div className="col-span-2 bg-red-50 p-4 rounded-2xl flex items-center justify-between border border-red-100 shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="bg-red-100 p-2 rounded-xl text-red-600">
                <AlertCircle size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-red-900 leading-tight">Missed Follow-ups</h4>
                <p className="text-[10px] text-red-600 font-bold uppercase tracking-wider">{stats.missedFollowups} tasks rolled over</p>
              </div>
            </div>
            <Link to="/followups" className="bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform">
              View
            </Link>
          </div>
        )}
      </div>

      {/* Performance Summary Card */}
      <div className="bg-brand-900 rounded-3xl p-6 text-white overflow-hidden relative shadow-xl shadow-brand-100">
        <div className="relative z-10 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-brand-300 text-xs font-bold uppercase tracking-widest">{getFilterLabel()}</span>
            <div className="flex items-center space-x-1 text-emerald-400 bg-white/10 px-2 py-1 rounded-lg">
              <Activity size={12} />
              <span className="text-[10px] font-bold">Live Data</span>
            </div>
          </div>
          
          <div className="space-y-1">
            <h3 className="text-3xl font-bold">{formatCurrency(stats.collectedInPeriod)}</h3>
            <p className="text-brand-300 text-xs font-medium">Logged across {stats.visitsInPeriod} customer interactions</p>
          </div>

          <div className="border-t border-white/10 pt-4 flex justify-between items-center">
             <div>
                <p className="text-[9px] text-brand-300 font-bold uppercase tracking-widest">Current Remaining Balance</p>
                <p className="font-bold text-lg">{formatCurrency(stats.totalPending)}</p>
             </div>
             <div className="text-right">
                <p className="text-[9px] text-brand-300 font-bold uppercase tracking-widest">Pending Portfolio</p>
             </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-brand-800 rounded-full blur-3xl opacity-50 pointer-events-none" />
      </div>

      {/* OVERDUE AGEING BUCKETS */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold">Overdue Ageing</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="premium-card p-4 text-center border-b-4 border-yellow-400">
            <div className="text-2xl font-black text-slate-800">{stats.overdue0to7}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">0-7 Days</div>
          </div>
          <div className="premium-card p-4 text-center border-b-4 border-orange-500">
            <div className="text-2xl font-black text-slate-800">{stats.overdue8to30}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">8-30 Days</div>
          </div>
          <div className="premium-card p-4 text-center border-b-4 border-red-600">
            <div className="text-2xl font-black text-slate-800">{stats.overdue30plus}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">30+ Days</div>
          </div>
        </div>
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
    <div className="premium-card p-4 space-y-3 flex flex-col justify-between h-full">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
        {icon}
      </div>
      <div className="mt-2">
        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">{label}</p>
        <h3 className="text-2xl font-black text-slate-900 leading-none mt-1">{value}</h3>
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