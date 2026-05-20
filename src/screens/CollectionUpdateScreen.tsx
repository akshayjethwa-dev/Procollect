import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  auth,
  db,
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  limit,
} from '../lib/firebase';
import { getUserAgencyId } from '../lib/firebase';
import {
  ChevronLeft,
  IndianRupee,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Camera,
  Clock,
  History,
  MapPin,
  Image as ImageIcon,
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { uploadFieldDocument } from '../lib/storage';

// Types matching CampaignBuilderScreen
type FieldType = 'text' | 'currency' | 'date';
type ActionBehavior = 'full_payment' | 'partial_payment' | 'promise_to_pay' | 'visit';

type CampaignAction = {
  id: string;
  label: string;
  color: string;
  behavior: ActionBehavior;
  showAmount: boolean;
  autoAmountFromDue: boolean;
  showNextDate: boolean;
  showNotes: boolean;
  showReceipt: boolean;
  showSelfie: boolean;
};

type CampaignTemplate = {
  id?: string;
  agencyId: string;
  name: string;
  isDefault?: boolean;
  fields: { id: string; name: string; type: FieldType }[];
  primaryFieldId?: string;
  secondaryFieldId?: string;
  actions: CampaignAction[];
};

// Fallback to your existing statuses in case campaign is not set up yet
const LEGACY_STATUS_OPTIONS: CampaignAction[] = [
  {
    id: 'Full Payment',
    label: 'Full Payment',
    color: 'bg-emerald-500',
    behavior: 'full_payment',
    showAmount: true,
    autoAmountFromDue: true,
    showNextDate: false,
    showNotes: true,
    showReceipt: true,
    showSelfie: true,
  },
  {
    id: 'Partial Payment',
    label: 'Partial Payment',
    color: 'bg-brand-500',
    behavior: 'partial_payment',
    showAmount: true,
    autoAmountFromDue: false,
    showNextDate: true,
    showNotes: true,
    showReceipt: true,
    showSelfie: true,
  },
  {
    id: 'Promise to Pay',
    label: 'Promise to Pay',
    color: 'bg-orange-500',
    behavior: 'promise_to_pay',
    showAmount: false,
    autoAmountFromDue: false,
    showNextDate: true,
    showNotes: true,
    showReceipt: false,
    showSelfie: false,
  },
  {
    id: 'Not Reachable',
    label: 'Not Reachable',
    color: 'bg-slate-500',
    behavior: 'visit',
    showAmount: false,
    autoAmountFromDue: false,
    showNextDate: false,
    showNotes: true,
    showReceipt: false,
    showSelfie: false,
  },
  {
    id: 'Wrong Address',
    label: 'Wrong Address',
    color: 'bg-red-500',
    behavior: 'visit',
    showAmount: false,
    autoAmountFromDue: false,
    showNextDate: false,
    showNotes: true,
    showReceipt: false,
    showSelfie: false,
  },
  {
    id: 'Refused',
    label: 'Refused',
    color: 'bg-red-700',
    behavior: 'visit',
    showAmount: false,
    autoAmountFromDue: false,
    showNextDate: false,
    showNotes: true,
    showReceipt: false,
    showSelfie: false,
  },
  {
    id: 'Dispute',
    label: 'Dispute',
    color: 'bg-purple-500',
    behavior: 'visit',
    showAmount: false,
    autoAmountFromDue: false,
    showNextDate: false,
    showNotes: true,
    showReceipt: false,
    showSelfie: false,
  },
  {
    id: 'Customer Shifted',
    label: 'Shifted',
    color: 'bg-amber-600',
    behavior: 'visit',
    showAmount: false,
    autoAmountFromDue: false,
    showNextDate: false,
    showNotes: true,
    showReceipt: false,
    showSelfie: false,
  },
  {
    id: 'Deceased',
    label: 'Deceased',
    color: 'bg-black',
    behavior: 'visit',
    showAmount: false,
    autoAmountFromDue: false,
    showNextDate: false,
    showNotes: true,
    showReceipt: false,
    showSelfie: false,
  },
];

export default function CollectionUpdateScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [campaign, setCampaign] = useState<CampaignTemplate | null>(null);
  const [availableActions, setAvailableActions] = useState<CampaignAction[]>(LEGACY_STATUS_OPTIONS);

  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Proof upload states
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // History states
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Fetch customer profile + capture location
  useEffect(() => {
    const fetchCustomer = async () => {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, 'customers', id));
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() };
          setCustomer(data);

          // After we know customer, try loading its campaign
          const rawAgencyId = await getUserAgencyId();
          const agencyId = rawAgencyId || 'UNASSIGNED';

          const customerCampaignId = (data as any).campaignId;
          
          if (customerCampaignId === 'system-default-loan') {
            // 1. Intercept the Hardcoded System Default
            setCampaign(null);
            setAvailableActions(LEGACY_STATUS_OPTIONS);
          } else if (customerCampaignId) {
            // 2. Fetch Custom Campaigns
            const campSnap = await getDoc(doc(db, 'campaigns', customerCampaignId));
            if (campSnap.exists()) {
              const camp = { id: campSnap.id, ...(campSnap.data() as any) } as CampaignTemplate;
              setCampaign(camp);
              setAvailableActions(camp.actions && camp.actions.length > 0 ? camp.actions : LEGACY_STATUS_OPTIONS);
            } else {
              setAvailableActions(LEGACY_STATUS_OPTIONS);
            }
          } else {
            // No campaignId on customer: Try fetching a user default, or fallback
            const campaignsRef = collection(db, 'campaigns');
            const q = query(campaignsRef, where('agencyId', '==', agencyId));
            const snapshot = await getDocs(q);
            const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as CampaignTemplate[];
            const defaultCampaign = list.find((c) => c.isDefault);
            if (defaultCampaign && defaultCampaign.actions && defaultCampaign.actions.length > 0) {
              setCampaign(defaultCampaign);
              setAvailableActions(defaultCampaign.actions);
            } else {
              setAvailableActions(LEGACY_STATUS_OPTIONS);
            }
          }
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, `customers/${id}`);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchCustomer();
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => console.log('Location denied'),
      );
    }
  }, [id]);

  // Fetch visit history (unchanged)
  useEffect(() => {
    if (id) {
      const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
          const historyQuery = query(
            collection(db, 'interactions'),
            where('customerId', '==', id),
            orderBy('timestamp', 'desc'),
            limit(10),
          );
          const snapshot = await getDocs(historyQuery);
          setHistory(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
          console.error('Error fetching visit history:', error);
        } finally {
          setLoadingHistory(false);
        }
      };
      fetchHistory();
    }
  }, [id]);

  const activeAction = selectedActionId
    ? availableActions.find((a) => a.id === selectedActionId || a.label === selectedActionId)
    : null;

  // Update amount when selecting an action that auto-fills from due
  useEffect(() => {
    if (!activeAction || !customer) return;
    const displayDue =
      customer.totalDueAmount !== undefined ? customer.totalDueAmount : customer.dueAmount || 0;
    if (activeAction.showAmount && activeAction.autoAmountFromDue) {
      setAmount(String(displayDue || 0));
    }
  }, [activeAction, customer]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'receipt' | 'selfie') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    if (type === 'receipt') setUploadingReceipt(true);
    else setUploadingSelfie(true);

    try {
      const result = await uploadFieldDocument(file);
      if (type === 'receipt') {
        setReceiptUrl(result.url);
      } else {
        setSelfieUrl(result.url);
      }
    } catch (err: any) {
      console.error(`Error uploading ${type}:`, err);
      setUploadError(`Failed to upload ${type}. Please try again.`);
    } finally {
      if (type === 'receipt') setUploadingReceipt(false);
      else setUploadingSelfie(false);
      e.target.value = '';
    }
  };

  const handleUpdate = async () => {
    if (!id || !activeAction || !customer) return;
    setSaving(true);
    try {
      const rawAgencyId = await getUserAgencyId();
      const agencyId = rawAgencyId || 'UNASSIGNED';

      const isoTimestamp = new Date().toISOString();
      const updateData: any = {
        status: activeAction.label,
        lastActionDate: isoTimestamp,
        lastVisitNotes: notes,
      };

      const currentDue =
        customer.totalDueAmount !== undefined ? customer.totalDueAmount : customer.dueAmount || 0;
      const currentReceived =
        customer.totalReceivedAmount !== undefined
          ? customer.totalReceivedAmount
          : customer.receivedAmount || 0;

      if (activeAction.behavior === 'full_payment') {
        updateData.dueAmount = 0;
        updateData.totalDueAmount = 0;
        updateData.receivedAmount = currentReceived + currentDue;
        updateData.totalReceivedAmount = currentReceived + currentDue;
      } else if (activeAction.behavior === 'partial_payment') {
        const collected = parseFloat(amount) || 0;
        updateData.dueAmount = Math.max(0, currentDue - collected);
        updateData.totalDueAmount = Math.max(0, currentDue - collected);
        updateData.receivedAmount = currentReceived + collected;
        updateData.totalReceivedAmount = currentReceived + collected;

        if (nextDate) updateData.nextFollowUp = nextDate;
      } else if (activeAction.behavior === 'promise_to_pay') {
        if (nextDate) updateData.nextFollowUp = nextDate;
      }

      await updateDoc(doc(db, 'customers', id), updateData);

      await addDoc(collection(db, 'interactions'), {
        agencyId,
        customerId: id,
        customerName: customer.name,
        loanId: customer.loanId || 'N/A',
        agentId: auth.currentUser?.uid,
        type: activeAction.behavior === 'full_payment' || activeAction.behavior === 'partial_payment' ? 'payment' : 'visit',
        status: activeAction.label,
        amount: activeAction.showAmount
          ? amount
            ? parseFloat(amount)
            : activeAction.behavior === 'full_payment'
            ? currentDue
            : 0
          : 0,
        notes,
        receiptUrl,
        selfieUrl,
        timestamp: isoTimestamp,
        location: location || null,
      });

      if (
        activeAction.showNextDate &&
        nextDate &&
        (activeAction.behavior === 'partial_payment' || activeAction.behavior === 'promise_to_pay')
      ) {
        await addDoc(collection(db, 'followups'), {
          agencyId,
          customerId: id,
          customerName: customer.name,
          mobile: customer.mobile,
          loanId: customer.loanId || 'N/A',
          agentId: auth.currentUser?.uid,
          scheduledAt: nextDate,
          type: activeAction.behavior === 'promise_to_pay' ? 'promise' : 'visit',
          completed: false,
          notes,
          timestamp: isoTimestamp,
        });

        await addDoc(collection(db, 'notifications'), {
          agencyId,
          recipientId: auth.currentUser?.uid,
          title: `Follow-up set: ${customer.name}`,
          message: `Scheduled for ${nextDate} (Loan: ${customer.loanId || 'N/A'})`,
          read: false,
          timestamp: isoTimestamp,
        });
      }

      navigate('/customers');
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, `customers/${id}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Loading customer profile...</div>;
  }
  if (!customer) {
    return (
      <div className="p-8 text-center flex flex-col items-center space-y-2">
        <AlertCircle className="text-slate-400" size={32} />
        <span className="text-slate-500 font-medium">Record not found</span>
        <button
          onClick={() => navigate('/customers')}
          className="text-brand-600 font-bold text-sm"
        >
          Go Back
        </button>
      </div>
    );
  }

  const displayDue =
    customer.totalDueAmount !== undefined ? customer.totalDueAmount : customer.dueAmount || 0;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header block – unchanged */}
      <div className="bg-brand-600 text-white p-6 pt-12 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center space-x-2 text-brand-100 font-bold uppercase text-[10px] tracking-widest hover:text-white transition-colors relative z-10"
        >
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
            <span className="text-brand-300 text-[10px] font-bold uppercase tracking-widest">
              Total Outstanding
            </span>
            <div className="text-3xl font-black">{formatCurrency(displayDue)}</div>
          </div>
          <div className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 flex flex-col items-end">
            <span className="text-[9px] font-bold uppercase tracking-widest text-brand-200">
              Due Date
            </span>
            <span className="text-xs font-bold text-white">{customer.dueDate || 'N/A'}</span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8 flex-1 pb-24">
        {/* Status buttons – now driven by availableActions */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-800">Update Visit Status</h2>
          <div className="grid grid-cols-2 gap-3">
            {availableActions.map((status) => (
              <button
                key={status.id}
                onClick={() => setSelectedActionId(status.id)}
                className={cn(
                  'p-4 rounded-2xl border-2 flex flex-col items-start justify-between space-y-2 transition-all active:scale-95',
                  selectedActionId === status.id
                    ? 'bg-white border-brand-500 shadow-md transform scale-[1.02]'
                    : 'bg-white border-transparent shadow-sm hover:border-slate-200 hover:shadow-md text-slate-500',
                )}
              >
                <div className={cn('w-2.5 h-2.5 rounded-full shadow-sm', status.color)} />
                <span
                  className={cn(
                    'text-xs font-bold uppercase tracking-tight',
                    selectedActionId === status.id ? 'text-brand-600' : 'text-slate-600',
                  )}
                >
                  {status.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeAction && (
            <motion.div
              key={activeAction.id}
              initial={{ height: 0, opacity: 0, y: 10 }}
              animate={{ height: 'auto', opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden space-y-6 origin-top"
            >
              <div className="premium-card p-6 space-y-6 bg-white border border-slate-100 rounded-3xl shadow-sm">
                {/* Amount */}
                {activeAction.showAmount && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                      Amount Collected
                    </label>
                    <div className="relative">
                      <IndianRupee
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="number"
                        placeholder="0.00"
                        className="w-full bg-slate-50 border-none rounded-xl p-4 pl-12 font-bold text-lg focus:ring-2 focus:ring-brand-500 outline-none transition-shadow"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        disabled={activeAction.autoAmountFromDue}
                      />
                    </div>
                  </div>
                )}

                {/* Next follow-up date */}
                {activeAction.showNextDate && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                      Next Follow-up Date
                    </label>
                    <div className="relative">
                      <Calendar
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="date"
                        className="w-full bg-slate-50 border-none rounded-xl p-4 pl-12 font-bold focus:ring-2 focus:ring-brand-500 outline-none transition-shadow text-slate-700"
                        value={nextDate}
                        onChange={(e) => setNextDate(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Visit Notes */}
                {activeAction.showNotes && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                      Visit Notes
                    </label>
                    <textarea
                      placeholder="Enter visit remarks..."
                      className="w-full bg-slate-50 border-none rounded-xl p-4 min-h-25 text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-shadow resize-none"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                )}

                {uploadError && (
                  <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-xl text-xs font-bold flex items-center space-x-2">
                    <AlertCircle size={16} />
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* Receipt / Selfie controls configured by action */}
                {(activeAction.showReceipt || activeAction.showSelfie) && (
                  <div className="grid grid-cols-2 gap-3">
                    {activeAction.showReceipt && (
                      <label className="relative h-24 flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl text-slate-400 space-y-1 border border-slate-100 cursor-pointer overflow-hidden active:bg-slate-100 hover:bg-slate-100/50 transition-colors">
                        {receiptUrl && (
                          <div className="absolute inset-0 bg-slate-900/10 z-0">
                            <img
                              src={receiptUrl}
                              alt="Receipt Proof"
                              className="w-full h-full object-cover opacity-60"
                            />
                          </div>
                        )}
                        <div className="relative z-10 flex flex-col items-center drop-shadow-md">
                          {uploadingReceipt ? (
                            <Clock size={20} className="text-brand-500 animate-spin" />
                          ) : receiptUrl ? (
                            <CheckCircle2 size={20} className="text-emerald-500" />
                          ) : (
                            <Camera size={20} className="text-brand-500" />
                          )}
                          <span
                            className={cn(
                              'text-[10px] font-bold uppercase mt-1',
                              receiptUrl ? 'text-emerald-700' : 'text-slate-600',
                            )}
                          >
                            {uploadingReceipt
                              ? 'Uploading...'
                              : receiptUrl
                              ? 'Receipt Added'
                              : 'Receipt'}
                          </span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(e, 'receipt')}
                          disabled={uploadingReceipt || uploadingSelfie}
                        />
                      </label>
                    )}

                    {activeAction.showSelfie && (
                      <label className="relative h-24 flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl text-slate-400 space-y-1 border border-slate-100 cursor-pointer overflow-hidden active:bg-slate-100 hover:bg-slate-100/50 transition-colors">
                        {selfieUrl && (
                          <div className="absolute inset-0 bg-slate-900/10 z-0">
                            <img
                              src={selfieUrl}
                              alt="Selfie Proof"
                              className="w-full h-full object-cover opacity-60"
                            />
                          </div>
                        )}
                        <div className="relative z-10 flex flex-col items-center drop-shadow-md">
                          {uploadingSelfie ? (
                            <Clock size={20} className="text-brand-500 animate-spin" />
                          ) : selfieUrl ? (
                            <CheckCircle2 size={20} className="text-emerald-500" />
                          ) : (
                            <Camera size={20} className="text-brand-500" />
                          )}
                          <span
                            className={cn(
                              'text-[10px] font-bold uppercase mt-1',
                              selfieUrl ? 'text-emerald-700' : 'text-slate-600',
                            )}
                          >
                            {uploadingSelfie
                              ? 'Uploading...'
                              : selfieUrl
                              ? 'Selfie Added'
                              : 'Selfie'}
                          </span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          capture="user"
                          className="hidden"
                          onChange={(e) => handleImageUpload(e, 'selfie')}
                          disabled={uploadingReceipt || uploadingSelfie}
                        />
                      </label>
                    )}
                  </div>
                )}

                {/* Submit button unchanged, but validation uses activeAction */}
                <button
                  onClick={handleUpdate}
                  disabled={
                    saving ||
                    uploadingReceipt ||
                    uploadingSelfie ||
                    (activeAction.showAmount &&
                      !activeAction.autoAmountFromDue &&
                      !amount)
                  }
                  className="w-full bg-brand-600 text-white p-5 rounded-2xl font-bold flex items-center justify-center space-x-2 shadow-lg shadow-brand-100 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform hover:bg-brand-700"
                >
                  {saving ? <Clock className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                  <span>{saving ? 'Saving Update...' : 'Submit Collection'}</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Visit History section */}
        <div className="pt-8 border-t border-slate-200 mt-8 space-y-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
            <History className="text-brand-500" size={20} />
            <span>Visit History</span>
          </h2>

          {loadingHistory ? (
            <div className="text-center p-6 text-slate-400 flex flex-col items-center space-y-2">
              <Clock className="animate-spin" size={24} />
              <span className="text-sm font-medium">Loading previous visits...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center p-6 bg-slate-100/50 rounded-2xl border border-slate-100 text-slate-500 text-sm font-medium">
              No previous visits recorded for this customer.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {new Date(item.timestamp).toLocaleDateString()} •{' '}
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <p className="text-sm font-bold text-slate-800 mt-0.5">{item.status}</p>
                    </div>
                    {item.amount > 0 && (
                      <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg text-sm">
                        {formatCurrency(item.amount)}
                      </span>
                    )}
                  </div>

                  {item.notes && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100/50">
                      {item.notes}
                    </p>
                  )}

                  {(item.location || item.receiptUrl || item.selfieUrl) && (
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-50 mt-1">
                      {item.location && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${item.location.lat},${item.location.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-brand-600 bg-brand-50 px-2.5 py-1.5 rounded-lg hover:bg-brand-100 transition-colors"
                        >
                          <MapPin size={12} /> Map Location
                        </a>
                      )}
                      {item.receiptUrl && (
                        <a
                          href={item.receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                          <ImageIcon size={12} /> View Receipt
                        </a>
                      )}
                      {item.selfieUrl && (
                        <a
                          href={item.selfieUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <ImageIcon size={12} /> View Selfie
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}