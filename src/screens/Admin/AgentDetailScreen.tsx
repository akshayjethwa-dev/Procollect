// src/screens/Admin/AgentDetailScreen.tsx
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, doc, getDoc, getDocs, collection, query, where, onSnapshot } from '../../lib/firebase';
import { formatCurrency, cn } from '../../lib/utils';
import { ChevronLeft, Wallet, Clock, CheckCircle2, XCircle, FileText, History, User, ClipboardList, ChevronDown, ChevronUp, ArrowRight, Loader2 } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

interface DepositRequest {
  id: string;
  agentId: string;
  amount: number;
  status: string;
  notes: string;
  rejectionReason?: string;
  createdAt: string;
}

const isToday = (dateString: string | undefined) => {
  if (!dateString) return false;
  const targetDate = new Date(dateString);
  const today = new Date();
  return targetDate.getDate() === today.getDate() &&
         targetDate.getMonth() === today.getMonth() &&
         targetDate.getFullYear() === today.getFullYear();
};

// --- History Card Sub-Component ---
function CustomerHistoryCard({ customer, agentsMap }: { customer: any, agentsMap: Record<string, string> }) {
  const [history, setHistory] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggleHistory = async () => {
    if (!isOpen && history.length === 0) {
      setLoading(true);
      try {
        const hQuery = query(collection(db, 'customers', customer.id, 'assignmentHistory'));
        const snap = await getDocs(hQuery);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
        data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setHistory(data);
      } catch (e) {
        console.error("Failed to load history", e);
      } finally {
        setLoading(false);
      }
    }
    setIsOpen(!isOpen);
  };

  const name = customer.name || customer.payload?.name || 'Unknown Name';
  const loanId = customer.loanId || customer.payload?.loanId || 'N/A';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-3 transition-all">
      <button 
        onClick={toggleHistory}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition text-left"
      >
        <div>
          <p className="font-bold text-slate-800">{name}</p>
          <p className="text-xs text-slate-500 font-medium">ID: {loanId}</p>
        </div>
        <div className="flex items-center text-slate-400">
          <span className="text-xs font-semibold mr-2">Audit Log</span>
          {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </button>

      {isOpen && (
        <div className="bg-slate-50 p-4 border-t border-slate-100">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-2">No assignment history logged for this record.</p>
          ) : (
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-linear-to-b before:from-transparent before:via-slate-200 before:to-transparent">
              {history.map((log, index) => {
                const dateObj = new Date(log.timestamp);
                const assignedBy = agentsMap[log.assignedBy] || log.assignedBy || 'System';
                const assignedTo = agentsMap[log.assignedTo] || log.assignedTo || 'Unknown';
                const previous = log.previousAgentId ? agentsMap[log.previousAgentId] || log.previousAgentId : 'Unassigned';

                return (
                  <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-5 h-5 rounded-full border border-white bg-slate-300 group-[.is-active]:bg-brand-500 text-slate-500 group-[.is-active]:text-emerald-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2" />
                    <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-lg border border-slate-200 bg-white shadow-sm text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-800 text-xs">Action by: {assignedBy}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">{dateObj.toLocaleDateString()} {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2 bg-slate-50 p-2 rounded border border-slate-100">
                        <span className="text-xs font-medium text-slate-500 line-through">{previous}</span>
                        <ArrowRight size={12} className="text-brand-500" />
                        <span className="text-xs font-bold text-brand-700">{assignedTo}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
// ------------------------------------------

export default function AgentDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [agentProfile, setAgentProfile] = useState<any>(null);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  
  // New States for Assignment History
  const [assignedCustomers, setAssignedCustomers] = useState<any[]>([]);
  const [agentsMap, setAgentsMap] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    // Fetch all users to create an ID -> Name map for the audit log
    getDocs(query(collection(db, 'users'))).then(snap => {
      const map: Record<string, string> = {};
      snap.forEach(d => {
        map[d.id] = d.data().name || d.data().email || d.id;
      });
      setAgentsMap(map);
    }).catch(e => console.error("Failed to map agents:", e));

    getDoc(doc(db, 'users', id)).then(snap => {
      if (snap.exists()) setAgentProfile(snap.data());
    }).catch(e => console.error("Failed to fetch agent profile:", e));

    const qInteractions = query(collection(db, 'interactions'), where('agentId', '==', id));
    const unsubInteractions = onSnapshot(qInteractions, (snap) => {
      setInteractions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qDeposits = query(collection(db, 'cashDeposits'), where('agentId', '==', id));
    const unsubDeposits = onSnapshot(qDeposits, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as DepositRequest[];
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setDeposits(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cashDeposits_agent');
      setLoading(false);
    });

    // Listen to customers currently assigned to this agent
    const qCustomers = query(collection(db, 'customers'), where('assignedAgentId', '==', id));
    const unsubCustomers = onSnapshot(qCustomers, snap => {
      setAssignedCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubInteractions();
      unsubDeposits();
      unsubCustomers();
    };
  }, [id]);

  const stats = useMemo(() => {
    let cashToday = 0;
    let pendingHandover = 0;
    let approvedHandover = 0;

    interactions.forEach(interaction => {
      if (interaction.type === 'payment' && isToday(interaction.timestamp)) {
        cashToday += Number(interaction.amount || 0);
      }
    });

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
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8">
      
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

      {/* Metrics */}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Assigned Records & History */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList className="text-brand-500" /> Active Records
            </h2>
            <span className="bg-brand-100 text-brand-700 text-xs font-bold px-2 py-1 rounded-lg">
              {assignedCustomers.length} Records
            </span>
          </div>
          
          {assignedCustomers.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-slate-100 text-slate-500">
              No active records assigned to this agent.
            </div>
          ) : (
            <div className="max-h-150 overflow-y-auto pr-2 pb-4">
              {assignedCustomers.map(customer => (
                <CustomerHistoryCard 
                  key={customer.id} 
                  customer={customer} 
                  agentsMap={agentsMap} 
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Deposit Ledger */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <History className="text-emerald-500" /> Deposit Ledger
          </h2>
          
          {deposits.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-100 text-slate-500">
              No deposit history found for this agent.
            </div>
          ) : (
            <div className="space-y-3 max-h-150 overflow-y-auto pr-2 pb-4">
              {deposits.map((deposit) => {
                const statusDisplay = getStatusDisplay(deposit.status);
                const dateObj = new Date(deposit.createdAt);
                
                return (
                  <div key={deposit.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between items-start gap-4">
                    <div className="w-full flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          {dateObj.toLocaleDateString()} • {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <h3 className="text-xl font-black text-slate-800">{formatCurrency(deposit.amount)}</h3>
                      </div>
                      
                      <div className={cn("px-3 py-1.5 rounded-xl flex items-center space-x-1.5 border", statusDisplay.bg, statusDisplay.color, deposit.status === 'pending' ? 'border-orange-200' : deposit.status === 'approved' ? 'border-emerald-200' : 'border-red-200')}>
                        {statusDisplay.icon}
                        <span className="text-[10px] font-bold uppercase tracking-wider">{statusDisplay.label}</span>
                      </div>
                    </div>

                    <div className="w-full">
                      {deposit.notes && (
                        <div className="flex items-start space-x-2 text-slate-600 text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
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
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}