import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, collection, addDoc, query, where, getDocs } from '../lib/firebase';
import { getUserAgencyId } from '../lib/firebase';
import { ChevronLeft, Wallet, IndianRupee, CheckCircle2, Clock, FileText } from 'lucide-react';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function SubmitDepositScreen() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate Net Cash in Hand on mount to auto-fill
  useEffect(() => {
    const fetchNetCash = async () => {
      if (!auth.currentUser) return;
      const agentId = auth.currentUser.uid;
      const todayStr = new Date().toISOString().split('T')[0];

      try {
        // 1. Fetch today's payments
        const qInteractions = query(collection(db, 'interactions'), where('agentId', '==', agentId));
        const interactionsSnap = await getDocs(qInteractions);
        let cashToday = 0;
        
        interactionsSnap.forEach(doc => {
          const data = doc.data();
          if (data.type === 'payment' && data.timestamp && data.timestamp.startsWith(todayStr)) {
            cashToday += Number(data.amount || 0);
          }
        });

        // 2. Fetch today's deposits
        const qDeposits = query(collection(db, 'cashDeposits'), where('agentId', '==', agentId));
        const depositsSnap = await getDocs(qDeposits);
        let handedOver = 0;

        depositsSnap.forEach(doc => {
          const data = doc.data();
          if (data.createdAt && data.createdAt.startsWith(todayStr)) {
            if (data.status === 'pending' || data.status === 'approved') {
              handedOver += Number(data.amount || 0);
            }
          }
        });

        const netCash = Math.max(0, cashToday - handedOver);
        
        // Auto-fill the amount if there is cash to hand over
        if (netCash > 0) {
          setAmount(netCash.toString());
        }
      } catch (err) {
        console.error("Error calculating net cash:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchNetCash();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const agencyId = await getUserAgencyId() || 'UNASSIGNED';
      const agentId = auth.currentUser?.uid;
      const agentName = auth.currentUser?.displayName || 'Agent';

      await addDoc(collection(db, 'cashDeposits'), {
        agentId,
        agentName,
        agencyId,
        amount: parseFloat(amount),
        status: 'pending',
        notes: notes || 'Cash handover request',
        createdAt: new Date().toISOString()
      });

      // Show success and navigate back
      alert('Deposit request submitted successfully!');
      navigate(-1);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'cashDeposits');
      setError("Failed to submit deposit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 pt-12 rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center space-x-2 text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-white transition-colors relative z-10">
          <ChevronLeft size={16} />
          <span>Back</span>
        </button>
        
        <div className="relative z-10 flex items-center space-x-4">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-emerald-400">
            <Wallet size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Handover Cash</h1>
            <p className="text-slate-400 text-xs font-medium">Request manager approval for deposit</p>
          </div>
        </div>
      </div>

      {/* Form Area */}
      <div className="p-6 flex-1 -mt-4 relative z-10">
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6">
          
          {loading ? (
             <div className="flex items-center justify-center py-4 space-x-2 text-brand-600">
               <Clock className="animate-spin" size={18} />
               <span className="text-sm font-bold">Calculating drawer balance...</span>
             </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold border border-red-100">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount to Deposit</label>
                <div className="relative">
                  <IndianRupee size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    required
                    className="w-full bg-slate-50 border-none rounded-xl p-4 pl-12 font-black text-2xl text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-medium ml-1">Auto-filled with your current Net Cash in Hand</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Deposit Notes</label>
                <div className="relative">
                  <FileText size={18} className="absolute left-4 top-4 text-slate-400" />
                  <textarea
                    placeholder="E.g., Handed to John at front desk..."
                    className="w-full bg-slate-50 border-none rounded-xl p-4 pl-12 min-h-25 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={submitting || loading}
                className="w-full bg-emerald-500 text-white p-5 rounded-2xl font-bold flex items-center justify-center space-x-2 shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform mt-4"
              >
                {submitting ? <Clock className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                <span>{submitting ? 'Submitting...' : 'Submit Request'}</span>
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}