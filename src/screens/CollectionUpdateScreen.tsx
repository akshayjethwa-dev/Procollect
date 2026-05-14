import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
// ✅ ADDED: getDocs, query, where, and Layers icon
import { auth, db, doc, getDoc, updateDoc, collection, addDoc, serverTimestamp, getDocs, query, where } from '../lib/firebase';
import { ChevronLeft, IndianRupee, Calendar, CheckCircle2, AlertCircle, Camera, Clock, Layers } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

const STATUS_OPTIONS = [
  { id: 'Full Payment', label: 'Full Payment', color: 'bg-emerald-500' },
  { id: 'Partial Payment', label: 'Partial Payment', color: 'bg-brand-500' },
  { id: 'Promise to Pay', label: 'Promise to Pay', color: 'bg-orange-500' },
  { id: 'Not Reachable', label: 'Not Reachable', color: 'bg-slate-500' },
  { id: 'Wrong Address', label: 'Wrong Address', color: 'bg-red-500' },
  { id: 'Refused', label: 'Refused', color: 'bg-red-700' },
  { id: 'Dispute', label: 'Dispute', color: 'bg-purple-500' },
  { id: 'Customer Shifted', label: 'Shifted', color: 'bg-amber-600' },
  { id: 'Deceased', label: 'Deceased', color: 'bg-black' },
];

export default function CollectionUpdateScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<any>(null);
  
  // --- NEW: State for handling multiple loans ---
  const [loans, setLoans] = useState<any[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!id) return;
      try {
        const custSnap = await getDoc(doc(db, 'customers', id));
        if (custSnap.exists()) {
          const custData = { id: custSnap.id, ...(custSnap.data() as any) };
          setCustomer(custData);

          // Fetch Loans from Subcollection
          const loansSnap = await getDocs(collection(db, 'customers', id, 'loans'));
          const fetchedLoans = loansSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

          // Legacy Support: If customer has a loanId but no subcollection yet
          if (custData.loanId && fetchedLoans.length === 0) {
             fetchedLoans.push({
                id: custData.id, // using customer ID to signify we update the main doc
                isLegacy: true,
                loanId: custData.loanId,
                dueAmount: custData.dueAmount || 0,
                receivedAmount: custData.receivedAmount || 0,
                status: custData.status || 'Pending'
             });
          }

          setLoans(fetchedLoans);
          // Auto-select if there is only 1 loan
          if (fetchedLoans.length === 1) setSelectedLoan(fetchedLoans[0]);
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, `customers/${id}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDetails();

    // Capture location for proof of visit
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }, () => console.log("Location denied"));
    }
  }, [id]);

  const handleUpdate = async () => {
    if (!id || !selectedStatus || !customer || !selectedLoan) return;
    setSaving(true);
    
    try {
      const timestamp = serverTimestamp();
      const isoTimestamp = new Date().toISOString();
      
      let updatedDueAmount = selectedLoan.dueAmount;
      let addedReceived = 0;

      // Calculate Payment logic locally
      if (selectedStatus === 'Full Payment') {
        addedReceived = selectedLoan.dueAmount;
        updatedDueAmount = 0;
      } else if (selectedStatus === 'Partial Payment') {
        addedReceived = parseFloat(amount) || 0;
        updatedDueAmount = Math.max(0, selectedLoan.dueAmount - addedReceived);
      }

      // Prepare Update Object for the Loan
      const loanUpdateData: any = {
        status: selectedStatus,
        dueAmount: updatedDueAmount,
        receivedAmount: (selectedLoan.receivedAmount || 0) + addedReceived,
        lastActionDate: isoTimestamp,
        lastVisitNotes: notes,
      };

      if (nextDate && (selectedStatus === 'Partial Payment' || selectedStatus === 'Promise to Pay')) {
        loanUpdateData.nextFollowUp = nextDate;
      }

      // 1. Update the Database
      if (selectedLoan.isLegacy) {
        // Update customer doc directly (Legacy mode)
        await updateDoc(doc(db, 'customers', id), loanUpdateData);
      } else {
        // Update subcollection doc
        await updateDoc(doc(db, 'customers', id, 'loans', selectedLoan.id), loanUpdateData);
         
        // 2. Recalculate & Update Customer Aggregate Totals
        const allLoans = loans.map(l => l.id === selectedLoan.id ? { ...l, ...loanUpdateData } : l);
        const newTotalDue = allLoans.reduce((sum, l) => sum + l.dueAmount, 0);
        const newTotalReceived = allLoans.reduce((sum, l) => sum + (l.receivedAmount || 0), 0);

        await updateDoc(doc(db, 'customers', id), {
          totalDueAmount: newTotalDue,
          totalReceivedAmount: newTotalReceived,
          status: selectedStatus, 
          lastActionDate: isoTimestamp
        });
      }

      // 3. Create Interaction Record
      await addDoc(collection(db, 'interactions'), {
        customerId: id,
        loanId: selectedLoan.loanId, // Track which loan this payment was for
        customerName: customer.name,
        agentId: auth.currentUser?.uid,
        type: selectedStatus.toLowerCase().includes('payment') ? 'payment' : 'visit',
        status: selectedStatus,
        amount: addedReceived,
        notes,
        timestamp,
        location: location || null
      });

      // 4. Create follow-up if needed
      if (nextDate && (selectedStatus === 'Partial Payment' || selectedStatus === 'Promise to Pay')) {
        await addDoc(collection(db, 'followups'), {
          customerId: id,
          customerName: customer.name,
          mobile: customer.mobile,
          agentId: auth.currentUser?.uid,
          scheduledAt: nextDate,
          type: selectedStatus === 'Promise to Pay' ? 'promise' : 'visit',
          completed: false,
          notes,
          timestamp
        });

        // Add a notification for the agent
        await addDoc(collection(db, 'notifications'), {
          recipientId: auth.currentUser?.uid,
          title: `Follow-up set: ${customer.name}`,
          message: `Scheduled for ${nextDate}`,
          read: false,
          timestamp
        });
      }

      navigate('/customers');
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, `customers/${id}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Loading customer profile...</div>;
  if (!customer) return <div className="p-8 text-center">Customer not found</div>;

  const displayTotalDue = customer.totalDueAmount !== undefined ? customer.totalDueAmount : (customer.dueAmount || 0);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="bg-brand-600 text-white p-6 pt-12 rounded-b-[2.5rem] shadow-lg">
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center space-x-2 text-brand-100 font-bold uppercase text-[10px] tracking-widest">
          <ChevronLeft size={16} />
          <span>Back to list</span>
        </button>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{customer.name}</h1>
          <p className="text-brand-100 text-xs font-medium">{customer.mobile}</p>
        </div>
        <div className="mt-8 flex justify-between items-end">
          <div className="space-y-1">
            <span className="text-brand-300 text-[10px] font-bold uppercase tracking-widest">Total Outstanding</span>
            <div className="text-3xl font-black">{formatCurrency(displayTotalDue)}</div>
          </div>
          {customer.dueDate && (
            <div className="bg-white/10 px-3 py-1 rounded-lg border border-white/10">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-200">Next Due: {customer.dueDate}</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 space-y-8 flex-1">
        
        {/* --- STEP 1: LOAN SELECTION --- */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold flex items-center">
            <Layers size={20} className="mr-2 text-brand-600"/> 
            Select Loan to Update
          </h2>
          
          <div className="space-y-3">
            {loans.map(loan => (
              <div 
                key={loan.id}
                onClick={() => setSelectedLoan(loan)}
                className={cn(
                  "p-4 rounded-2xl border-2 flex justify-between items-center cursor-pointer transition-all active:scale-95",
                  selectedLoan?.id === loan.id ? "bg-white border-brand-500 shadow-md" : "bg-white border-transparent shadow-sm"
                )}
              >
                <div>
                  <div className="font-bold text-slate-800">{loan.loanId || 'Legacy Loan'}</div>
                  <div className="text-xs text-slate-500 font-medium">Due: {formatCurrency(loan.dueAmount)}</div>
                </div>
                <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center", selectedLoan?.id === loan.id ? "border-brand-500 bg-brand-500" : "border-slate-300")}>
                  {selectedLoan?.id === loan.id && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
              </div>
            ))}
            {loans.length === 0 && (
               <p className="text-sm text-slate-500 italic">No active loans found for this customer.</p>
            )}
          </div>
        </div>

        {/* --- STEP 2: STATUS & PAYMENT UPDATE --- */}
        <AnimatePresence>
          {selectedLoan && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden space-y-6"
            >
              <div className="space-y-4">
                <h2 className="text-lg font-bold pt-4 border-t border-slate-200">Update Visit Status</h2>
                <div className="grid grid-cols-2 gap-3">
                  {STATUS_OPTIONS.map((status) => (
                    <button
                      key={status.id}
                      onClick={() => setSelectedStatus(status.id)}
                      className={cn(
                        "p-4 rounded-2xl border-2 flex flex-col items-start justify-between space-y-2 transition-all active:scale-95",
                        selectedStatus === status.id 
                          ? "bg-white border-brand-500 shadow-md" 
                          : "bg-white border-transparent shadow-sm"
                      )}
                    >
                      <div className={cn("w-2 h-2 rounded-full", status.color)} />
                      <span className={cn("text-xs font-bold uppercase tracking-tight", selectedStatus === status.id ? "text-brand-600" : "text-slate-600")}>
                        {status.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedStatus && (
                <div className="premium-card p-6 space-y-6 bg-white">
                  {(selectedStatus === 'Partial Payment' || selectedStatus === 'Full Payment') && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Amount Collected</label>
                      <div className="relative">
                        <IndianRupee size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="number"
                          placeholder="0.00"
                          className="w-full bg-slate-50 border-none rounded-xl p-4 pl-12 font-bold text-lg focus:ring-2 focus:ring-brand-500"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {(selectedStatus === 'Partial Payment' || selectedStatus === 'Promise to Pay') && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Next Follow-up Date</label>
                      <div className="relative">
                        <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="date"
                          className="w-full bg-slate-50 border-none rounded-xl p-4 pl-12 font-bold focus:ring-2 focus:ring-brand-500"
                          value={nextDate}
                          onChange={(e) => setNextDate(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Visit Notes</label>
                    <textarea
                      placeholder="Enter visit remarks..."
                      className="w-full bg-slate-50 border-none rounded-xl p-4 min-h-25 text-sm focus:ring-2 focus:ring-brand-500"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl text-slate-400 space-y-1 border border-slate-100 cursor-pointer active:bg-slate-100">
                      <Camera size={20} />
                      <span className="text-[10px] font-bold uppercase">Receipt</span>
                      <input type="file" accept="image/*" className="hidden" onChange={() => alert("Proof captured locally and will sync.")} />
                    </label>
                    <label className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl text-slate-400 space-y-1 border border-slate-100 cursor-pointer active:bg-slate-100">
                      <Camera size={20} />
                      <span className="text-[10px] font-bold uppercase">Selfie</span>
                      <input type="file" accept="image/*" capture="user" className="hidden" onChange={() => alert("Selfie captured.")} />
                    </label>
                  </div>

                  <button 
                    onClick={handleUpdate}
                    disabled={saving}
                    className="w-full bg-brand-600 text-white p-5 rounded-2xl font-bold flex items-center justify-center space-x-2 shadow-lg shadow-brand-100 disabled:opacity-50"
                  >
                    {saving ? <Clock className="animate-spin" /> : <CheckCircle2 size={20} />}
                    <span>{saving ? 'Saving Update...' : 'Submit Collection'}</span>
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}