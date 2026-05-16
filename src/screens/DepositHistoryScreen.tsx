import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, collection, query, where, onSnapshot } from '../lib/firebase';
import { formatCurrency, cn } from '../lib/utils';
import { ChevronLeft, Clock, CheckCircle2, XCircle, History, FileText } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface Deposit {
  id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  notes: string;
  rejectionReason?: string;
  createdAt: string;
  processedAt?: string;
}

export default function DepositHistoryScreen() {
  const navigate = useNavigate();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const agentId = auth.currentUser.uid;
    const qDeposits = query(
      collection(db, 'cashDeposits'),
      where('agentId', '==', agentId)
    );

    const unsubscribe = onSnapshot(qDeposits, (snapshot) => {
      const data: Deposit[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Deposit[];

      // Sort descending by createdAt (newest first)
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setDeposits(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cashDeposits');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'approved':
        return {
          icon: <CheckCircle2 size={18} />,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50',
          label: 'Approved'
        };
      case 'rejected':
        return {
          icon: <XCircle size={18} />,
          color: 'text-red-600',
          bg: 'bg-red-50',
          label: 'Rejected'
        };
      case 'pending':
      default:
        return {
          icon: <Clock size={18} />,
          color: 'text-orange-500',
          bg: 'bg-orange-50',
          label: 'Pending'
        };
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 pt-12 rounded-b-[2.5rem] shadow-lg relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center space-x-2 text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-white transition-colors relative z-10">
          <ChevronLeft size={16} />
          <span>Back</span>
        </button>
        
        <div className="relative z-10 flex items-center space-x-4">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-blue-400">
            <History size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Deposit History</h1>
            <p className="text-slate-400 text-xs font-medium">Track your cash handovers</p>
          </div>
        </div>
      </div>

      {/* List Area */}
      <div className="p-6 flex-1 overflow-auto space-y-4">
        {loading ? (
          <div className="flex justify-center items-center py-10 text-slate-400">
            <Clock className="animate-spin mr-2" size={20} />
            <span className="font-medium text-sm">Loading history...</span>
          </div>
        ) : deposits.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-slate-100 flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
              <History size={32} />
            </div>
            <h3 className="font-bold text-slate-800">No deposits yet</h3>
            <p className="text-xs text-slate-500 mt-1">Your handover history will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deposits.map((deposit) => {
              const statusDisplay = getStatusDisplay(deposit.status);
              const dateObj = new Date(deposit.createdAt);
              
              return (
                <div key={deposit.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {dateObj.toLocaleDateString()} • {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <h3 className="text-lg font-black text-slate-800 mt-0.5">{formatCurrency(deposit.amount)}</h3>
                    </div>
                    
                    <div className={cn("px-3 py-1.5 rounded-xl flex items-center space-x-1.5", statusDisplay.bg, statusDisplay.color)}>
                      {statusDisplay.icon}
                      <span className="text-[10px] font-bold uppercase tracking-wider">{statusDisplay.label}</span>
                    </div>
                  </div>

                  {deposit.notes && (
                    <div className="flex items-start space-x-2 text-slate-600 text-xs bg-slate-50 p-2.5 rounded-xl">
                      <FileText size={14} className="shrink-0 mt-0.5 text-slate-400" />
                      <p>{deposit.notes}</p>
                    </div>
                  )}

                  {/* Rejected Reason UI Component */}
                  {deposit.status === 'rejected' && deposit.rejectionReason && (
                    <div className="mt-2 text-xs text-red-600 bg-red-50/50 p-3 rounded-xl border border-red-100/50">
                      <span className="font-bold block mb-0.5 uppercase text-[10px] tracking-wider">Manager Reason:</span>
                      {deposit.rejectionReason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}