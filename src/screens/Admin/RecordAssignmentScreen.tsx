// src/screens/Admin/RecordAssignmentScreen.tsx
import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db, getUserAgencyId } from '../../lib/firebase';
import { Loader2, CheckSquare, Square, Users, LayoutTemplate, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

export default function RecordAssignmentScreen() {
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  
  const [records, setRecords] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const agencyId = await getUserAgencyId();
        if (!agencyId) throw new Error("Agency ID not found");

        // Fetch Custom Campaigns
        const campQuery = query(collection(db, 'campaigns'), where('agencyId', '==', agencyId));
        const campSnap = await getDocs(campQuery);
        const loadedCampaigns = campSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

        // FIX 1: Always inject the System Default campaign so imported default records are visible
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

        // Fetch Agents
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
    const fetchUnassignedRecords = async () => {
      if (!selectedCampaignId) return;
      setLoading(true);
      setError(null);
      try {
        const agencyId = await getUserAgencyId();
        
        try {
          // Attempt optimal indexed query
          const recordsQuery = query(
            collection(db, 'customers'),
            where('agencyId', '==', agencyId),
            where('campaignId', '==', selectedCampaignId),
            where('assignedAgentId', '==', null)
          );
          const recordsSnap = await getDocs(recordsQuery);
          setRecords(recordsSnap.docs.map(d => ({ id: d.id, ...d.data() as any })));
          
        } catch (indexError: any) {
          // FIX 2: Fallback for missing composite index. If Firebase throws an index error, 
          // we fetch by agency and filter the campaign and null agents on the client side.
          console.warn("Composite Index missing, falling back to client-side filtering.", indexError);
          
          const fallbackQuery = query(
            collection(db, 'customers'),
            where('agencyId', '==', agencyId)
          );
          const fallbackSnap = await getDocs(fallbackQuery);
          const allUnassigned = fallbackSnap.docs
            .map(d => ({ id: d.id, ...d.data() as any }))
            .filter(r => r.campaignId === selectedCampaignId && r.assignedAgentId === null);
            
          setRecords(allUnassigned);
        }
        
        // Reset selection when changing campaigns
        setSelectedRecordIds(new Set());
      } catch (err: any) {
        console.error("Failed to load records", err);
        setError("Failed to load records: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchUnassignedRecords();
  }, [selectedCampaignId]);

  const selectedCampaign = useMemo(() => {
    return campaigns.find(c => c.id === selectedCampaignId);
  }, [campaigns, selectedCampaignId]);

  // Determine dynamic columns based on Campaign schema, fallback to defaults
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
    
    try {
      let batch = writeBatch(db);
      let count = 0;
      
      for (const recordId of Array.from(selectedRecordIds)) {
        const ref = doc(db, 'customers', recordId);
        batch.update(ref, {
          assignedAgentId: selectedAgentId,
          updatedAt: new Date().toISOString()
        });
        count++;
        
        // Firebase batch limit is 500, we chunk at 450 to be safe
        if (count >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      
      if (count > 0) {
        await batch.commit();
      }
      
      // Update UI state by removing assigned records
      setRecords(prev => prev.filter(r => !selectedRecordIds.has(r.id)));
      setSelectedRecordIds(new Set());
      setSelectedAgentId('');
    } catch (err: any) {
      setError(err.message || "Failed to assign records");
    } finally {
      setAssigning(false);
    }
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Assign Records</h1>
          <p className="text-sm text-slate-500">Distribute unassigned records to your agents</p>
        </div>

        <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
          <LayoutTemplate className="text-brand-500 w-5 h-5 ml-2" />
          <select
            value={selectedCampaignId}
            onChange={(e) => setSelectedCampaignId(e.target.value)}
            className="bg-transparent font-semibold text-slate-700 outline-none pr-4 py-1"
          >
            <option disabled value="">Select Campaign Filter</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center space-x-3 border border-red-100">
          <AlertCircle size={20} className="shrink-0" />
          <p className="text-sm font-bold">{error}</p>
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
                {columns.map((col: any) => (
                  <th key={col.id} className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length + 1} className="py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-brand-500 mx-auto" />
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="py-12 text-center text-slate-500 font-medium">
                    No unassigned records found for this campaign.
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

      {/* Floating Action Bar */}
      {selectedRecordIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 z-50 animate-in slide-in-from-bottom-10 w-[90%] max-w-2xl border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="bg-brand-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
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
              <option value="" disabled>Assign to Agent...</option>
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
            {assigning ? 'Assigning...' : 'Assign'}
          </button>
        </div>
      )}
    </div>
  );
}