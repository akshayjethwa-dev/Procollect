import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, doc, getDoc, collection, query, where, onSnapshot } from '../../lib/firebase';
import { formatCurrency, cn } from '../../lib/utils';
import { ChevronLeft, Wallet, Clock, CheckCircle2, XCircle, FileText, History, User } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

// FIX: Added interface to resolve TypeScript errors
interface DepositRequest {
  id: string;
  agentId: string;
  amount: number;
  status: string;
  notes: string;
  rejectionReason?: string;
  createdAt: string;
}

// Helper to check if a date string is today
const isToday = (dateString: string | undefined) => {
  if (!dateString) return false;
  const targetDate = new Date(dateString);
  const today = new Date();
  return targetDate.getDate() === today.getDate() &&
         targetDate.getMonth() === today.getMonth() &&
         targetDate.getFullYear() === today.getFullYear();
};

export default function AgentDetailScreen() {
  const { id } = useParams(); // This is the agentId
  const navigate = useNavigate();
  
  const [agentProfile, setAgentProfile] = useState<any>(null);
  const [interactions, setInteractions] = useState<any[]>([]);
  
  // FIX: Applied the interface to the state
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    // 1. Fetch Agent Profile
    getDoc(doc(db, 'users', id)).then(snap => {
      if (snap.exists()) setAgentProfile(snap.data());
    }).catch(e => console.error("Failed to fetch agent profile:", e));

    // 2. Listen to Agent's interactions (for today's cash collected)
    const qInteractions = query(collection(db, 'interactions'), where('agentId', '==', id));
    const unsubInteractions = onSnapshot(qInteractions, (snap) => {
      setInteractions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 3. Listen to Agent's cash deposits (for history and metrics)
    const qDeposits = query(collection(db, 'cashDeposits'), where('agentId', '==', id));
    const unsubDeposits = onSnapshot(qDeposits, (snap) => {
      // FIX: Cast mapped data to our new interface
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as DepositRequest[];
      
      // Sort descending by createdAt (No more TS Errors!)
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setDeposits(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cashDeposits_agent');
      setLoading(false);
    });

    return () => {
      unsubInteractions();
      unsubDeposits();
    };
  }, [id]);

  // Calculate matching metrics to Task 2
  const stats = useMemo(() => {
    let cashToday = 0;
    let pendingHandover = 0;
    let approvedHandover = 0;

    // Sum today's collections
    interactions.forEach(interaction => {
      if (interaction.type === 'payment' && isToday(interaction.timestamp)) {
        cashToday += Number(interaction.amount || 0);
      }
    });

    // Sum today's deposits
    deposits.forEach(dep => {
      if (isToday(dep.createdAt)) {
        if (dep.status === 'pending') pendingHandover += Number(dep.amount || 0);
        if (dep.status === 'approved') approvedHandover += Number(dep.amount || 0);
      }
    });

    const netCash = Math.max(0, cashToday - (pendingHandover + approvedHandover));

    return { cashToday, pendingHandover, approvedHandover, netCash };
  }, [interactions, deposits]);

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'approved':
        return { icon: <CheckCircle2 size={16} />, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Approved' };
      case 'rejected':
        return { icon: <XCircle size={16} />, color: 'text-red-600', bg: 'bg-red-50', label: 'Rejected' };
      case 'pending':
      default:
        return { icon: <Clock size={16} />, color: 'text-orange-500', bg: 'bg-orange-50', label: 'Pending' };
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Loading agent data...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-50 transition-colors border border-slate-100">
          <ChevronLeft size={24} className="text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <User className="text-brand-500" />
            {agentProfile?.name || 'Agent Ledger'}
          </h1>
          <p className="text-sm text-slate-500">Live financial audit and history</p>
        </div>
      </div>

      {/* Same Metrics as Agent Dashboard */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -top-10 text-slate-800 opacity-20 pointer-events-none">
          <Wallet size={150} />
        </div>
        
        <div className="relative z-10 flex justify-between items-start">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5">
              <Wallet size={14} /> Expected Cash in Pocket
            </p>
            <h2 className="text-4xl font-black text-emerald-400 mt-1">{formatCurrency(stats.netCash)}</h2>
          </div>
          <div className="bg-white/10 px-3 py-1.5 rounded-lg flex items-center space-x-1.5 text-emerald-400">
            <Clock size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Today's Cycle</span>
          </div>
        </div>
        
        <div className="relative z-10 grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-white/10">
          <div>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Total Collected</p>
            <p className="font-bold text-lg text-white mt-1">{formatCurrency(stats.cashToday)}</p>
          </div>
          <div>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Pending</p>
            <p className="font-bold text-lg text-orange-400 mt-1">{formatCurrency(stats.pendingHandover)}</p>
          </div>
          <div>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Handed Over</p>
            <p className="font-bold text-lg text-blue-400 mt-1">{formatCurrency(stats.approvedHandover)}</p>
          </div>
        </div>
      </div>

      {/* History Ledger */}
      <div className="space-y-4 pt-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <History className="text-brand-500" /> Deposit Ledger
        </h2>
        
        {deposits.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-100 text-slate-500">
            No deposit history found for this agent.
          </div>
        ) : (
          <div className="space-y-3">
            {deposits.map((deposit) => {
              const statusDisplay = getStatusDisplay(deposit.status);
              const dateObj = new Date(deposit.createdAt);
              
              return (
                <div key={deposit.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      {dateObj.toLocaleDateString()} • {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <h3 className="text-xl font-black text-slate-800">{formatCurrency(deposit.amount)}</h3>
                    
                    {deposit.notes && (
                      <div className="flex items-start space-x-2 text-slate-600 text-xs bg-slate-50 p-2 mt-2 rounded-lg border border-slate-100">
                        <FileText size={14} className="shrink-0 mt-0.5 text-slate-400" />
                        <p>{deposit.notes}</p>
                      </div>
                    )}

                    {deposit.status === 'rejected' && deposit.rejectionReason && (
                      <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">
                        <span className="font-bold block mb-0.5">Manager Reason:</span>
                        {deposit.rejectionReason}
                      </div>
                    )}
                  </div>
                  
                  <div className={cn("px-4 py-2 rounded-xl flex items-center space-x-2 border", statusDisplay.bg, statusDisplay.color, deposit.status === 'pending' ? 'border-orange-200' : deposit.status === 'approved' ? 'border-emerald-200' : 'border-red-200')}>
                    {statusDisplay.icon}
                    <span className="text-xs font-bold uppercase tracking-wider">{statusDisplay.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}