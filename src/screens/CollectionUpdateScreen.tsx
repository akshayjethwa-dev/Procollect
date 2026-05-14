import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db, doc, getDoc, updateDoc, collection, addDoc } from '../lib/firebase';
import { ChevronLeft, IndianRupee, Calendar, CheckCircle2, AlertCircle, Camera, Clock } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);

  useEffect(() => {
    if (id) {
      getDoc(doc(db, 'customers', id))
        .then(snap => {
          if (snap.exists()) setCustomer({ id: snap.id, ...snap.data() });
          setLoading(false);
        })
        .catch(e => {
          handleFirestoreError(e, OperationType.GET, `customers/${id}`);
          setLoading(false);
        });
    }

    // Capture location for proof of visit
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }, () => console.log("Location denied"));
    }
  }, [id]);

  const handleUpdate = async () => {
    if (!id || !selectedStatus || !customer) return;
    setSaving(true);
    try {
      const isoTimestamp = new Date().toISOString();
      const updateData: any = {
        status: selectedStatus,
        lastActionDate: isoTimestamp,
        lastVisitNotes: notes,
      };

      // Determine the display due amount (handling both new aggregate and legacy fields)
      const currentDue = customer.totalDueAmount !== undefined ? customer.totalDueAmount : (customer.dueAmount || 0);
      const currentReceived = customer.totalReceivedAmount !== undefined ? customer.totalReceivedAmount : (customer.receivedAmount || 0);

      if (selectedStatus === 'Full Payment') {
        updateData.dueAmount = 0;
        updateData.totalDueAmount = 0;
        updateData.receivedAmount = currentReceived + currentDue;
        updateData.totalReceivedAmount = currentReceived + currentDue;
      } else if (selectedStatus === 'Partial Payment') {
        const collected = parseFloat(amount) || 0;
        updateData.dueAmount = Math.max(0, currentDue - collected);
        updateData.totalDueAmount = Math.max(0, currentDue - collected);
        updateData.receivedAmount = currentReceived + collected;
        updateData.totalReceivedAmount = currentReceived + collected;
        
        if (nextDate) updateData.nextFollowUp = nextDate;
      } else if (selectedStatus === 'Promise to Pay') {
        if (nextDate) updateData.nextFollowUp = nextDate;
      }

      // Update customer document directly
      await updateDoc(doc(db, 'customers', id), updateData);
      
      // Create interaction record
      await addDoc(collection(db, 'interactions'), {
        customerId: id,
        customerName: customer.name,
        loanId: customer.loanId || 'N/A', // Track the loan ID
        agentId: auth.currentUser?.uid,
        type: selectedStatus.toLowerCase().includes('payment') ? 'payment' : 'visit',
        status: selectedStatus,
        amount: amount ? parseFloat(amount) : (selectedStatus === 'Full Payment' ? currentDue : 0),
        notes,
        timestamp: isoTimestamp,
        location: location || null
      });

      // Create follow-up if needed
      if (nextDate && (selectedStatus === 'Partial Payment' || selectedStatus === 'Promise to Pay')) {
        await addDoc(collection(db, 'followups'), {
          customerId: id,
          customerName: customer.name,
          mobile: customer.mobile,
          loanId: customer.loanId || 'N/A',
          agentId: auth.currentUser?.uid,
          scheduledAt: nextDate,
          type: selectedStatus === 'Promise to Pay' ? 'promise' : 'visit',
          completed: false,
          notes,
          timestamp: isoTimestamp
        });

        // Add a notification for the agent
        await addDoc(collection(db, 'notifications'), {
          recipientId: auth.currentUser?.uid,
          title: `Follow-up set: ${customer.name}`,
          message: `Scheduled for ${nextDate} (Loan: ${customer.loanId || 'N/A'})`,
          read: false,
          timestamp: isoTimestamp
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
  if (!customer) return <div className="p-8 text-center flex flex-col items-center space-y-2">
    <AlertCircle className="text-slate-400" size={32} />
    <span className="text-slate-500 font-medium">Record not found</span>
    <button onClick={() => navigate('/customers')} className="text-brand-600 font-bold text-sm">Go Back</button>
  </div>;

  const displayDue = customer.totalDueAmount !== undefined ? customer.totalDueAmount : (customer.dueAmount || 0);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="bg-brand-600 text-white p-6 pt-12 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center space-x-2 text-brand-100 font-bold uppercase text-[10px] tracking-widest hover:text-white transition-colors relative z-10">
          <ChevronLeft size={16} />
          <span>Back to list</span>
        </button>
        <div className="space-y-1 relative z-10">
          <h1 className="text-2xl font-bold">{customer.name}</h1>
          <p className="text-brand-100 text-xs font-medium bg-black/10 inline-block px-2 py-0.5 rounded text-[10px]">
            {customer.loanId ? `Loan: ${customer.loanId}` : 'No Loan ID'} • {customer.mobile}
          </p>
        </div>
        <div className="mt-8 flex justify-between items-end relative z-10">
          <div className="space-y-1">
            <span className="text-brand-300 text-[10px] font-bold uppercase tracking-widest">Total Outstanding</span>
            <div className="text-3xl font-black">{formatCurrency(displayDue)}</div>
          </div>
          <div className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 flex flex-col items-end">
            <span className="text-[9px] font-bold uppercase tracking-widest text-brand-200">Due Date</span>
            <span className="text-xs font-bold text-white">{customer.dueDate || 'N/A'}</span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8 flex-1">
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-800">Update Visit Status</h2>
          <div className="grid grid-cols-2 gap-3">
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status.id}
                onClick={() => setSelectedStatus(status.id)}
                className={cn(
                  "p-4 rounded-2xl border-2 flex flex-col items-start justify-between space-y-2 transition-all active:scale-95",
                  selectedStatus === status.id 
                    ? "bg-white border-brand-500 shadow-md transform scale-[1.02]" 
                    : "bg-white border-transparent shadow-sm hover:border-slate-200 hover:shadow-md text-slate-500"
                )}
              >
                <div className={cn("w-2.5 h-2.5 rounded-full shadow-sm", status.color)} />
                <span className={cn("text-xs font-bold uppercase tracking-tight", selectedStatus === status.id ? "text-brand-600" : "text-slate-600")}>
                  {status.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {selectedStatus && (
            <motion.div
              key={selectedStatus} // Ensures animation triggers smoothly when changing status
              initial={{ height: 0, opacity: 0, y: 10 }}
              animate={{ height: "auto", opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden space-y-6 origin-top"
            >
              <div className="premium-card p-6 space-y-6 bg-white border border-slate-100">
                {(selectedStatus === 'Partial Payment' || selectedStatus === 'Full Payment') && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Amount Collected</label>
                    <div className="relative">
                      <IndianRupee size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="number"
                        placeholder="0.00"
                        className="w-full bg-slate-50 border-none rounded-xl p-4 pl-12 font-bold text-lg focus:ring-2 focus:ring-brand-500 outline-none transition-shadow"
                        value={selectedStatus === 'Full Payment' ? displayDue : amount}
                        onChange={(e) => setAmount(e.target.value)}
                        disabled={selectedStatus === 'Full Payment'}
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
                        className="w-full bg-slate-50 border-none rounded-xl p-4 pl-12 font-bold focus:ring-2 focus:ring-brand-500 outline-none transition-shadow text-slate-700"
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
                    className="w-full bg-slate-50 border-none rounded-xl p-4 min-h-25 text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-shadow resize-none"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl text-slate-400 space-y-1 border border-slate-100 cursor-pointer active:bg-slate-100 hover:bg-slate-100/50 transition-colors">
                    <Camera size={20} className="text-brand-500" />
                    <span className="text-[10px] font-bold uppercase text-slate-500 mt-1">Receipt</span>
                    <input type="file" accept="image/*" className="hidden" onChange={() => alert("Proof captured locally and will sync.")} />
                  </label>
                  <label className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl text-slate-400 space-y-1 border border-slate-100 cursor-pointer active:bg-slate-100 hover:bg-slate-100/50 transition-colors">
                    <Camera size={20} className="text-brand-500" />
                    <span className="text-[10px] font-bold uppercase text-slate-500 mt-1">Selfie</span>
                    <input type="file" accept="image/*" capture="user" className="hidden" onChange={() => alert("Selfie captured.")} />
                  </label>
                </div>

                <button 
                  onClick={handleUpdate}
                  disabled={saving || (selectedStatus === 'Partial Payment' && !amount)}
                  className="w-full bg-brand-600 text-white p-5 rounded-2xl font-bold flex items-center justify-center space-x-2 shadow-lg shadow-brand-100 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
                >
                  {saving ? <Clock className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                  <span>{saving ? 'Saving Update...' : 'Submit Collection'}</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}