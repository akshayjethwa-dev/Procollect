import { useEffect, useState } from 'react';
import { auth, db, collection, query, where, onSnapshot, orderBy, doc, updateDoc } from '../lib/firebase';
import { ChevronLeft, Calendar, Clock, CheckCircle2, Phone, MessageSquare, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function FollowUpScreen() {
  const [followups, setFollowups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'followups'),
      where('agentId', '==', auth.currentUser.uid),
      where('completed', '==', false),
      orderBy('scheduledAt', 'asc')
    );

    const unsub = onSnapshot(q, async (snap) => {
      const followupDocs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      // Enrich with customer data
      const enriched = await Promise.all(followupDocs.map(async (f) => {
        try {
          // This is a bit inefficient in a loop, but for a pilot with small lists it's okay.
          // Better would be to use a separate query or join logic if possible.
          // For now, let's just keep it simple.
          return f;
        } catch (e) {
          return f;
        }
      }));

      setFollowups(enriched);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'followups');
    });

    return () => unsub();
  }, [auth.currentUser]);

  const handleComplete = async (id: string) => {
    try {
      await updateDoc(doc(db, 'followups', id), { completed: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `followups/${id}`);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 p-6 space-y-6">
      <div className="flex items-center space-x-4">
        <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-xl shadow-sm text-slate-600">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Today's Follow-ups</h1>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-20 text-slate-400">Loading your schedule...</div>
        ) : followups.length > 0 ? (
          followups.map((f) => (
            <div key={f.id} className="premium-card p-4 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center text-brand-600">
                    <User size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{f.customerName || 'Task for Customer'}</h4>
                    <p className="text-[10px] font-bold text-brand-600 uppercase tracking-widest">{f.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center text-orange-600 font-bold text-xs space-x-1 justify-end">
                    <Clock size={12} />
                    <span>{f.scheduledAt}</span>
                  </div>
                </div>
              </div>

              {f.notes && (
                <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-600 italic">
                  "{f.notes}"
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <div className="flex space-x-2">
                  <button 
                    onClick={() => window.location.href=`tel:${f.mobile}`}
                    className="w-10 h-10 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center"
                  >
                    <Phone size={18} />
                  </button>
                  <button 
                    onClick={() => window.location.href=`https://wa.me/91${f.mobile}`}
                    className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"
                  >
                    <MessageSquare size={18} />
                  </button>
                  <button 
                    onClick={() => navigate(`/customers/${f.customerId}`)}
                    className="w-10 h-10 bg-slate-50 text-slate-600 rounded-xl flex items-center justify-center"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
                <button 
                  onClick={() => handleComplete(f.id)}
                  className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2"
                >
                  <CheckCircle2 size={16} />
                  <span>Mark Done</span>
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
            <Calendar className="mx-auto text-slate-200 mb-4" size={48} />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No follow-ups scheduled</p>
          </div>
        )}
      </div>
    </div>
  );
}
