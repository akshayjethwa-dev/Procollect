import { useEffect, useState } from 'react';
import { auth, db, collection, query, where, onSnapshot, orderBy, doc, updateDoc } from '../lib/firebase';
import { ChevronLeft, Calendar, Clock, CheckCircle2, Phone, MessageSquare, User, ChevronRight, AlertCircle, RefreshCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { cn } from '../lib/utils';

type TabType = 'Overdue' | 'Today' | 'Upcoming';

export default function FollowUpScreen() {
  const [followups, setFollowups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('Today');
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.currentUser) return;

    // FIX: Removed agencyId to restore legacy follow-up tasks
    const q = query(
      collection(db, 'followups'),
      where('agentId', '==', auth.currentUser.uid),
      where('completed', '==', false),
      orderBy('scheduledAt', 'asc')
    );

    const unsub = onSnapshot(q, async (snap) => {
      const followupDocs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      const enriched = await Promise.all(followupDocs.map(async (f) => f));

      setFollowups(enriched);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'followups');
    });

    return () => unsub();
  }, []);

  const handleComplete = async (id: string) => {
    const saveCompletion = async (coords: { lat: number, lng: number } | null) => {
      try {
        await updateDoc(doc(db, 'followups', id), { 
          completed: true,
          completedAt: new Date().toISOString(),
          completionLocation: coords
        });
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `followups/${id}`);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => saveCompletion({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => {
          console.warn("Could not fetch location:", err);
          saveCompletion(null); 
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      saveCompletion(null);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const counts = followups.reduce((acc, f) => {
    if (!f.scheduledAt) return acc;
    const taskDate = f.scheduledAt.split('T')[0];
    if (taskDate < todayStr) acc.Overdue++;
    else if (taskDate === todayStr) acc.Today++;
    else acc.Upcoming++;
    return acc;
  }, { Overdue: 0, Today: 0, Upcoming: 0 });

  const filteredFollowups = followups.filter(f => {
    if (!f.scheduledAt) return false;
    const taskDate = f.scheduledAt.split('T')[0];
    if (activeTab === 'Overdue') return taskDate < todayStr;
    if (activeTab === 'Today') return taskDate === todayStr;
    if (activeTab === 'Upcoming') return taskDate > todayStr;
    return false;
  });

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-xl shadow-sm text-slate-600">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Follow-ups</h1>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 bg-slate-200/50 p-1.5 rounded-[1.25rem]">
        {(['Overdue', 'Today', 'Upcoming'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5",
              activeTab === tab 
                ? tab === 'Overdue' 
                  ? "bg-red-500 text-white shadow-md shadow-red-200" 
                  : "bg-brand-600 text-white shadow-md shadow-brand-200"
                : "text-slate-500 hover:bg-slate-200"
            )}
          >
            <span>{tab}</span>
            <span className={cn(
              "px-1.5 py-0.5 rounded-md text-[10px]",
              activeTab === tab ? "bg-white/20" : "bg-slate-300/50"
            )}>
              {counts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-20 text-slate-400">Loading your schedule...</div>
        ) : filteredFollowups.length > 0 ? (
          filteredFollowups.map((f) => {
            // Check if this task was auto-rescheduled by the system
            const isRescheduled = f.rescheduledCount && f.rescheduledCount > 0;

            return (
              <div key={f.id} className={cn(
                "premium-card p-4 space-y-4",
                (activeTab === 'Overdue' || isRescheduled) && "border-l-4 border-l-red-500"
              )}>
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      (activeTab === 'Overdue' || isRescheduled) ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-600"
                    )}>
                      <User size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{f.customerName || 'Task for Customer'}</h4>
                      <p className={cn(
                        "text-[10px] font-bold uppercase tracking-widest",
                        (activeTab === 'Overdue' || isRescheduled) ? "text-red-600" : "text-brand-600"
                      )}>
                        {f.type || 'Visit'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <div className={cn(
                      "flex items-center font-bold text-xs space-x-1",
                      (activeTab === 'Overdue' || isRescheduled) ? "text-red-500" : "text-orange-600"
                    )}>
                      <Clock size={12} />
                      <span>{f.scheduledAt.split('T')[0]}</span>
                    </div>

                    {/* OVERDUE OR ROLLED OVER BADGE */}
                    {activeTab === 'Overdue' && (
                      <span className="flex items-center text-[9px] text-red-500 mt-1 uppercase tracking-wider font-black">
                        <AlertCircle size={10} className="mr-0.5" /> Overdue
                      </span>
                    )}
                    {isRescheduled && activeTab === 'Today' && (
                      <span className="flex items-center text-[9px] text-red-500 mt-1 uppercase tracking-wider font-black">
                        <RefreshCcw size={10} className="mr-0.5" /> Rolled Over ({f.rescheduledCount}x)
                      </span>
                    )}
                  </div>
                </div>

                {f.notes && (
                  <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-600 italic border border-slate-100">
                    "{f.notes}"
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <div className="flex space-x-2">
                    <a 
                      href={`tel:${f.mobile}`}
                      className="w-10 h-10 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center hover:bg-brand-100"
                    >
                      <Phone size={18} />
                    </a>
                    <a 
                      href={`https://wa.me/91${f.mobile}`} target="_blank" rel="noopener noreferrer"
                      className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center hover:bg-emerald-100"
                    >
                      <MessageSquare size={18} />
                    </a>
                    <button 
                      onClick={() => navigate(`/customers/${f.customerId}`)}
                      className="w-10 h-10 bg-slate-50 text-slate-600 rounded-xl flex items-center justify-center hover:bg-slate-100"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                  <button 
                    onClick={() => handleComplete(f.id)}
                    className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 active:scale-95 transition-transform"
                  >
                    <CheckCircle2 size={16} />
                    <span>Mark Done</span>
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
            <Calendar className="mx-auto text-slate-200 mb-4" size={48} />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
              No {activeTab.toLowerCase()} follow-ups
            </p>
          </div>
        )}
      </div>
    </div>
  );
}