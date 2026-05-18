import { useState, useEffect } from 'react';
import { auth, db, collection, query, where, onSnapshot, doc, updateDoc, getDocs } from '../../lib/firebase';
import { getUserAgencyId } from '../../lib/firebase';
import { formatCurrency } from '../../lib/utils';
import { Clock, Wallet, User, FileText, CheckCircle2, XCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import { Link } from 'react-router-dom';

interface DepositRequest {
  id: string;
  agentId: string;
  agentName: string;
  amount: number;
  status: string;
  notes: string;
  createdAt: string;
}

export default function PendingDepositsScreen() {
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedDepositId, setSelectedDepositId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    let unsubscribeDeposits: (() => void) | undefined;

    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setLoading(true);
        try {
          const agencyId = await getUserAgencyId() || user.uid;

          const agentsQuery = query(
            collection(db, 'users'),
            where('role', '==', 'agent'),
            where('agencyId', '==', agencyId)
          );
          const agentsSnap = await getDocs(agentsQuery);
          const validAgentIds = new Set(agentsSnap.docs.map(doc => doc.id));

          const qDeposits = query(
            collection(db, 'cashDeposits'),
            where('agencyId', '==', agencyId),
            where('status', '==', 'pending')
          );

          unsubscribeDeposits = onSnapshot(qDeposits, (snapshot) => {
            let data = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as DepositRequest[];

            data = data.filter(dep => validAgentIds.has(dep.agentId));
            data.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            
            setDeposits(data);
            setLoading(false);
          }, (error) => {
            handleFirestoreError(error, OperationType.LIST, 'cashDeposits_pending');
            setLoading(false);
          });
        } catch (error) {
          console.error("Error setting up deposits listener:", error);
          setLoading(false);
        }
      } else {
        setDeposits([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDeposits) unsubscribeDeposits();
    };
  }, []);

  const handleApprove = async (depositId: string) => {
    if (!auth.currentUser) return;
    setProcessingId(depositId);

    try {
      await updateDoc(doc(db, 'cashDeposits', depositId), {
        status: 'approved',
        processedAt: new Date().toISOString(),
        processedBy: auth.currentUser.uid
      });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `cashDeposits/${depositId}`);
      alert("Failed to approve the deposit. Please try again.");
      setProcessingId(null);
    }
  };

  const openRejectModal = (depositId: string) => {
    setSelectedDepositId(depositId);
    setRejectionReason('');
    setRejectModalOpen(true);
  };

  const confirmReject = async () => {
    if (!auth.currentUser || !selectedDepositId || !rejectionReason.trim()) return;
    
    setProcessingId(selectedDepositId);
    setRejectModalOpen(false);

    try {
      await updateDoc(doc(db, 'cashDeposits', selectedDepositId), {
        status: 'rejected',
        rejectionReason: rejectionReason.trim(),
        processedAt: new Date().toISOString(),
        processedBy: auth.currentUser.uid
      });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `cashDeposits/${selectedDepositId}`);
      alert("Failed to reject the deposit. Please try again.");
    } finally {
      setProcessingId(null);
      setSelectedDepositId(null);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 md:space-y-8 relative">
      
      {/* Mobile Back Button */}
      <div className="md:hidden">
        <Link to="/admin/dashboard" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold text-sm bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm transition-colors active:scale-95">
          <ArrowLeft size={16} /> Dashboard
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Wallet className="text-emerald-500" size={28} />
            Pending Handovers
          </h1>
          <p className="text-sm md:text-base text-slate-500 mt-2 font-medium">
            Review and reconcile cash collected by your agents.
          </p>
        </div>
        
        <div className="w-full md:w-auto bg-orange-50 text-orange-600 px-4 py-3 md:py-2 rounded-xl flex items-center justify-center space-x-2 border border-orange-100 font-bold">
          <Clock size={20} />
          <span>{deposits.length} Pending</span>
        </div>
      </div>

      {/* List Area */}
      {loading ? (
        <div className="flex justify-center items-center py-20 text-slate-400">
          <Clock className="animate-spin mr-2" size={24} />
          <span className="font-medium">Loading requests...</span>
        </div>
      ) : deposits.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-slate-200 flex flex-col items-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
            <CheckCircle2 size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-800">All Caught Up!</h3>
          <p className="text-slate-500 mt-2">There are no pending cash handovers to review.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {deposits.map((deposit) => {
            const dateObj = new Date(deposit.createdAt);
            const isProcessing = processingId === deposit.id;
            
            return (
              <div
                key={deposit.id}
                className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition-all hover:shadow-md"
              >
                {/* Info Section */}
                <div className="flex-1 space-y-4 w-full">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2 text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                      <User size={16} className="text-brand-500" />
                      <span className="font-bold text-sm">{deposit.agentName}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Clock size={12} />
                      {dateObj.toLocaleDateString()} • {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Amount Received
                    </span>
                    <span className="text-3xl font-black text-slate-900">
                      {formatCurrency(deposit.amount)}
                    </span>
                  </div>

                  {deposit.notes && (
                    <div className="flex items-start gap-2 text-sm text-slate-600 bg-amber-50/50 p-3 rounded-xl border border-amber-100/50">
                      <FileText size={16} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="font-medium">"{deposit.notes}"</p>
                    </div>
                  )}
                </div>

                {/* Actions Section */}
                <div className="w-full md:w-auto flex flex-col md:flex-col gap-3 shrink-0 mt-2 md:mt-0 border-t border-slate-100 pt-4 md:border-none md:pt-0">
                  <button 
                    onClick={() => handleApprove(deposit.id)}
                    disabled={isProcessing}
                    className="w-full md:w-auto bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 md:py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-emerald-200 active:scale-95"
                  >
                    {isProcessing ? <Clock size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                    {isProcessing ? 'Saving...' : 'Approve Amount'}
                  </button>
                  <button 
                    onClick={() => openRejectModal(deposit.id)}
                    disabled={isProcessing}
                    className="w-full md:w-auto bg-white hover:bg-red-50 text-red-600 border border-red-200 px-6 py-3 md:py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                  >
                    <XCircle size={18} /> Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rejection Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600 mb-2">
              <div className="bg-red-100 p-2 rounded-xl">
                <AlertCircle size={24} />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Reject Handover</h2>
            </div>
            
            <p className="text-sm text-slate-500">
              Please provide a reason for rejecting this deposit. The agent will see this reason on their dashboard.
            </p>

            <textarea
              autoFocus
              placeholder="E.g., Counted amount was ₹500 short..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-red-500 outline-none transition-shadow resize-none min-h-25"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setRejectModalOpen(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmReject}
                disabled={!rejectionReason.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}