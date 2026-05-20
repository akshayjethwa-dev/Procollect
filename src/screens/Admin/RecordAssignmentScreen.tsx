// src/screens/Admin/RecordAssignmentScreen.tsx
import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db, getUserAgencyId, auth } from '../../lib/firebase';
import { Loader2, CheckSquare, Square, Users, LayoutTemplate, AlertCircle, RefreshCw, Sparkles, X, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

export default function RecordAssignmentScreen() {
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<'unassigned' | 'assigned'>('unassigned');

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  
  const [records, setRecords] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  
  // Selection & Action States
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  
  // Auto-Distribute State
  const [showAutoModal, setShowAutoModal] = useState(false);
  
  // Filter for the "Assigned" tab
  const [filterAgentId, setFilterAgentId] = useState<string>('');

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const agencyId = await getUserAgencyId();
        if (!agencyId) throw new Error("Agency ID not found");

        const campQuery = query(collection(db, 'campaigns'), where('agencyId', '==', agencyId));
        const campSnap = await getDocs(campQuery);
        const loadedCampaigns = campSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

        const allCampaigns = [
          { 
            id: 'system-default-loan', 
            name: '⭐ System Default: Loan Collection', 
            schema: [
              { id: 'name', name: 'Name', type: 'text' },
              { id: 'loanId', name: 'Loan ID', type: 'text' },
              { id: 'mobile', name: 'Mobile', type: 'text' },
              { id: 'dueAmount', name: 'Due Amount', type: 'currency' }
            ] 
          },
          ...loadedCampaigns
        ];

        setCampaigns(allCampaigns);

        if (allCampaigns.length > 0) {
          setSelectedCampaignId(allCampaigns[0].id);
        }

        const agentsQuery = query(collection(db, 'users'), where('agencyId', '==', agencyId));
        const agentsSnap = await getDocs(agentsQuery);
        const loadedAgents = agentsSnap.docs
          .map(d => ({ id: d.id, ...d.data() as any }))
          .filter((u: any) => u.role === 'agent' || u.role === 'independent_agent');
        setAgents(loadedAgents);

      } catch (err: any) {
        setError(err.message || "Failed to load initial data");
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    const fetchRecords = async () => {
      if (!selectedCampaignId) return;
      setLoading(true);
      setError(null);
      try {
        const agencyId = await getUserAgencyId();
        
        try {
          let recordsQuery;
          
          if (activeTab === 'unassigned') {
            recordsQuery = query(
              collection(db, 'customers'),
              where('agencyId', '==', agencyId),
              where('campaignId', '==', selectedCampaignId),
              where('assignedAgentId', '==', null)
            );
          } else {
            if (filterAgentId) {
              recordsQuery = query(
                collection(db, 'customers'),
                where('agencyId', '==', agencyId),
                where('campaignId', '==', selectedCampaignId),
                where('assignedAgentId', '==', filterAgentId)
              );
            } else {
              throw new Error("Trigger fallback for 'All Assigned' filter");
            }
          }
          
          const recordsSnap = await getDocs(recordsQuery);
          setRecords(recordsSnap.docs.map(d => ({ id: d.id, ...d.data() as any })));
          
        } catch (indexError: any) {
          console.warn("Using client-side filtering fallback.", indexError.message);
          
          const fallbackQuery = query(
            collection(db, 'customers'),
            where('agencyId', '==', agencyId)
          );
          const fallbackSnap = await getDocs(fallbackQuery);
          let allData = fallbackSnap.docs
            .map(d => ({ id: d.id, ...d.data() as any }))
            .filter(r => r.campaignId === selectedCampaignId);
            
          if (activeTab === 'unassigned') {
            allData = allData.filter(r => r.assignedAgentId === null);
          } else {
            if (filterAgentId) {
              allData = allData.filter(r => r.assignedAgentId === filterAgentId);
            } else {
              allData = allData.filter(r => r.assignedAgentId !== null); 
            }
          }
            
          setRecords(allData);
        }
        
        setSelectedRecordIds(new Set());
      } catch (err: any) {
        console.error("Failed to load records", err);
        setError("Failed to load records: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, [selectedCampaignId, activeTab, filterAgentId]);

  const selectedCampaign = useMemo(() => {
    return campaigns.find(c => c.id === selectedCampaignId);
  }, [campaigns, selectedCampaignId]);

  const columns = useMemo(() => {
    const schema = selectedCampaign?.schema || [];
    if (schema.length > 0) {
      return schema;
    }
    return [
      { id: 'name', name: 'Name', type: 'text' },
      { id: 'loanId', name: 'Loan ID', type: 'text' },
      { id: 'mobile', name: 'Mobile', type: 'text' },
      { id: 'dueAmount', name: 'Due Amount', type: 'currency' }
    ];
  }, [selectedCampaign]);

  const handleSelectAll = () => {
    if (selectedRecordIds.size === records.length) {
      setSelectedRecordIds(new Set());
    } else {
      setSelectedRecordIds(new Set(records.map(r => r.id)));
    }
  };

  const toggleSelectRecord = (id: string) => {
    const next = new Set(selectedRecordIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRecordIds(next);
  };

  const handleAssign = async () => {
    if (!selectedAgentId || selectedRecordIds.size === 0) return;
    setAssigning(true);
    setError(null);
    setSuccess(null);
    
    try {
      let batch = writeBatch(db);
      let opCount = 0;
      
      const currentUserId = auth.currentUser?.uid || 'System';
      const timestamp = new Date().toISOString();
      
      for (const recordId of Array.from(selectedRecordIds)) {
        const recordToAssign = records.find(r => r.id === recordId);
        const previousAgentId = recordToAssign?.assignedAgentId || null;

        const ref = doc(db, 'customers', recordId);
        batch.update(ref, {
          assignedAgentId: selectedAgentId,
          updatedAt: timestamp
        });
        opCount++;
        
        const historyRef = doc(collection(db, 'customers', recordId, 'assignmentHistory'));
        batch.set(historyRef, {
          assignedBy: currentUserId,
          assignedTo: selectedAgentId,
          previousAgentId: previousAgentId,
          timestamp: timestamp
        });
        opCount++;
        
        if (opCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        }
      }
      
      if (opCount > 0) {
        await batch.commit();
      }
      
      setRecords(prev => {
        if (activeTab === 'unassigned') {
          return prev.filter(r => !selectedRecordIds.has(r.id));
        } else {
          if (filterAgentId && filterAgentId !== selectedAgentId) {
            return prev.filter(r => !selectedRecordIds.has(r.id));
          } else {
            return prev.map(r => selectedRecordIds.has(r.id) ? { ...r, assignedAgentId: selectedAgentId } : r);
          }
        }
      });

      setSelectedRecordIds(new Set());
      setSelectedAgentId('');
      setSuccess(`Successfully assigned ${selectedRecordIds.size} records.`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to assign records");
    } finally {
      setAssigning(false);
    }
  };

  // --- Auto Distribute Logic ---
  const handleAutoDistribute = async () => {
    if (agents.length === 0 || records.length === 0) return;
    
    setAssigning(true);
    setError(null);
    setSuccess(null);
    setShowAutoModal(false);

    try {
      let batch = writeBatch(db);
      let opCount = 0;
      
      const currentUserId = auth.currentUser?.uid || 'System';
      const timestamp = new Date().toISOString();
      
      // Round Robin Algorithm
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        
        // Use modulo to evenly wrap around the agents array
        const agentIndex = i % agents.length;
        const assignedAgentId = agents[agentIndex].id;

        // 1. Update Customer
        const ref = doc(db, 'customers', record.id);
        batch.update(ref, {
          assignedAgentId: assignedAgentId,
          updatedAt: timestamp
        });
        opCount++;
        
        // 2. Add History
        const historyRef = doc(collection(db, 'customers', record.id, 'assignmentHistory'));
        batch.set(historyRef, {
          assignedBy: currentUserId,
          assignedTo: assignedAgentId,
          previousAgentId: null,
          timestamp: timestamp
        });
        opCount++;
        
        if (opCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        }
      }
      
      if (opCount > 0) {
        await batch.commit();
      }

      const totalDistributed = records.length;
      
      // Clear out the unassigned records from view
      setRecords([]);
      setSelectedRecordIds(new Set());
      
      setSuccess(`${totalDistributed} records successfully auto-distributed to ${agents.length} agents.`);
      setTimeout(() => setSuccess(null), 5000);
      
    } catch (err: any) {
      setError(err.message || "Failed to auto-distribute records");
    } finally {
      setAssigning(false);
    }
  };

  const getAgentName = (id: string) => {
    const agent = agents.find(a => a.id === id);
    return agent ? agent.name : 'Unknown Agent';
  };

  if (loading && campaigns.length === 0) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="p-6 pb-32 max-w-6xl mx-auto space-y-6">
      
      {/* Auto Distribute Confirmation Modal */}
      {showAutoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-brand-50 p-6 flex items-start justify-between border-b border-brand-100">
              <div>
                <h3 className="text-xl font-bold text-brand-900 flex items-center gap-2">
                  <Sparkles className="text-brand-600" /> Auto-Distribute Records
                </h3>
                <p className="text-sm text-brand-700 mt-1">Smart round-robin assignment</p>
              </div>
              <button onClick={() => setShowAutoModal(false)} className="text-brand-400 hover:text-brand-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                <div className="text-3xl font-black text-slate-800 mb-1">{records.length}</div>
                <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Unassigned Records</div>
              </div>
              
              <div className="flex items-center justify-center gap-4 text-slate-500">
                <div className="h-px bg-slate-200 flex-1"></div>
                <span className="text-xs font-semibold">Divided evenly among</span>
                <div className="h-px bg-slate-200 flex-1"></div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                <div className="text-3xl font-black text-slate-800 mb-1">{agents.length}</div>
                <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Active Agents</div>
              </div>

              <div className="text-center">
                <p className="text-sm text-slate-600 font-medium">
                  Each agent will receive approximately <strong className="text-brand-600 text-lg">{Math.floor(records.length / (agents.length || 1))}</strong> records.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setShowAutoModal(false)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAutoDistribute}
                disabled={assigning || agents.length === 0}
                className="bg-brand-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-brand-500 transition shadow flex items-center gap-2 disabled:opacity-50"
              >
                {assigning ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                Confirm Distribution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-end border-b border-slate-200 pb-0 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Record Assignment</h1>
          <div className="flex mt-2">
            <button
              className={`px-5 py-3 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'unassigned' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('unassigned')}
            >
              Unassigned Records
            </button>
            <button
              className={`px-5 py-3 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'assigned' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('assigned')}
            >
              <RefreshCw className="w-4 h-4" />
              Re-assign Records
            </button>
          </div>
        </div>

        {/* Auto Distribute Button */}
        {activeTab === 'unassigned' && records.length > 0 && agents.length > 0 && (
          <button
            onClick={() => setShowAutoModal(true)}
            className="mb-3 bg-linear-to-r from-brand-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2"
          >
            <Sparkles size={16} />
            Auto Distribute All
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="flex-1">
          <p className="text-sm text-slate-500 font-medium">
            {activeTab === 'unassigned' 
              ? 'Select new records to manually assign, or use Auto Distribute.' 
              : 'Move previously assigned records from one agent to another.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          
          {/* Agent Filter (Only shown on Assigned Tab) */}
          {activeTab === 'assigned' && (
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm w-full sm:w-auto">
              <Users className="text-brand-500 w-4 h-4" />
              <select
                value={filterAgentId}
                onChange={(e) => setFilterAgentId(e.target.value)}
                className="bg-transparent font-semibold text-sm text-slate-700 outline-none w-full"
              >
                <option value="">All Agents</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Campaign Filter */}
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm w-full sm:w-auto">
            <LayoutTemplate className="text-brand-500 w-4 h-4" />
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="bg-transparent font-semibold text-sm text-slate-700 outline-none w-full"
            >
              <option disabled value="">Select Campaign</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center space-x-3 border border-red-100 animate-in fade-in slide-in-from-top-2">
          <AlertCircle size={20} className="shrink-0" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl flex items-center space-x-3 border border-emerald-100 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={20} className="shrink-0 text-emerald-500" />
          <p className="text-sm font-bold">{success}</p>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 w-12">
                  <button onClick={handleSelectAll} className="text-slate-400 hover:text-brand-600 transition">
                    {records.length > 0 && selectedRecordIds.size === records.length ? (
                      <CheckSquare className="w-5 h-5 text-brand-600" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                </th>
                
                {/* Extra column for current agent on Re-assign tab */}
                {activeTab === 'assigned' && (
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    Current Agent
                  </th>
                )}

                {columns.map((col: any) => (
                  <th key={col.id} className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading || assigning ? (
                <tr>
                  <td colSpan={columns.length + (activeTab === 'assigned' ? 2 : 1)} className="py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-brand-500 mx-auto mb-2" />
                    <p className="text-sm text-slate-500 font-medium">{assigning ? 'Processing Assignment...' : 'Loading Records...'}</p>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (activeTab === 'assigned' ? 2 : 1)} className="py-12 text-center text-slate-500 font-medium">
                    No {activeTab === 'assigned' ? 'assigned' : 'unassigned'} records found.
                  </td>
                </tr>
              ) : (
                records.map(record => (
                  <tr key={record.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                    <td className="p-4">
                      <button onClick={() => toggleSelectRecord(record.id)} className="text-slate-400 hover:text-brand-600 transition">
                        {selectedRecordIds.has(record.id) ? (
                          <CheckSquare className="w-5 h-5 text-brand-600" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                    
                    {/* Current Agent Data */}
                    {activeTab === 'assigned' && (
                      <td className="p-4 text-sm font-semibold text-brand-700 whitespace-nowrap">
                        {getAgentName(record.assignedAgentId)}
                      </td>
                    )}

                    {columns.map((col: any) => {
                      const val = record[col.id] || record[col.name?.toLowerCase()] || record.payload?.[col.id] || '-';
                      return (
                        <td key={col.id} className="p-4 text-sm text-slate-700 whitespace-nowrap">
                          {col.type === 'currency' ? formatCurrency(Number(val) || 0) : String(val)}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Action Bar (For Manual Assignment) */}
      {selectedRecordIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 z-50 animate-in slide-in-from-bottom-10 w-[90%] max-w-2xl border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="bg-brand-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-[0_0_15px_rgba(var(--brand-500),0.5)]">
              {selectedRecordIds.size}
            </div>
            <span className="font-semibold text-sm hidden sm:inline">Records Selected</span>
          </div>

          <div className="h-8 w-px bg-slate-700" />

          <div className="flex-1 flex items-center gap-3">
            <Users className="w-5 h-5 text-slate-400 shrink-0" />
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-sm rounded-xl px-3 py-2 w-full outline-none focus:border-brand-500 transition font-medium"
            >
              <option value="" disabled>
                {activeTab === 'assigned' ? 'Transfer to Agent...' : 'Assign to Agent...'}
              </option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleAssign}
            disabled={!selectedAgentId || assigning}
            className="bg-brand-600 hover:bg-brand-500 px-6 py-2 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {assigning ? (activeTab === 'assigned' ? 'Transferring...' : 'Assigning...') : (activeTab === 'assigned' ? 'Transfer' : 'Assign')}
          </button>
        </div>
      )}
    </div>
  );
}