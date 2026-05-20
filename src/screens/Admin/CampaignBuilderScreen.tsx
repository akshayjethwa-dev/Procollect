import { useEffect, useState } from 'react';
import { 
  ChevronLeft, Plus, Trash2, Save, Tag, Type, Calendar, 
  DollarSign, Palette, LayoutTemplate, CheckCircle2, FileText, ArrowLeft,
  Smartphone, Eye, Settings2, Info, Camera, Clock, IndianRupee, Lock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  db,
  collection,
  addDoc,
  updateDoc,
  getDocs,
  doc,
  query,
  where,
  getUserAgencyId
} from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

// --- Types & Constants ---
type FieldType = 'text' | 'currency' | 'date';

type CampaignField = { id: string; name: string; type: FieldType; };
type ActionBehavior = 'full_payment' | 'partial_payment' | 'promise_to_pay' | 'visit';

type CampaignAction = {
  id: string; label: string; color: string; behavior: ActionBehavior;
  showAmount: boolean; autoAmountFromDue: boolean; showNextDate: boolean;
  showNotes: boolean; showReceipt: boolean; showSelfie: boolean;
};

type CampaignTemplate = {
  id?: string; agencyId: string; name: string; isDefault?: boolean;
  fields: CampaignField[]; primaryFieldId?: string; secondaryFieldId?: string; actions: CampaignAction[];
};

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'currency', label: 'Currency' },
  { value: 'date', label: 'Date' },
];

const ACTION_BEHAVIOR_OPTIONS: { value: ActionBehavior; label: string }[] = [
  { value: 'full_payment', label: 'Full Payment (set due to 0)' },
  { value: 'partial_payment', label: 'Partial Payment (reduce due)' },
  { value: 'promise_to_pay', label: 'Promise to Pay (no amount)' },
  { value: 'visit', label: 'Visit / Info Only' },
];

const COLOR_PRESETS = [
  'bg-emerald-500', 'bg-brand-500', 'bg-blue-500', 'bg-indigo-500',
  'bg-purple-500', 'bg-pink-500', 'bg-red-500', 'bg-orange-500',
  'bg-amber-500', 'bg-slate-500', 'bg-slate-800'
];

// --- HARDCODED UNEDITABLE SYSTEM DEFAULT ---
const SYSTEM_DEFAULT_TEMPLATE: CampaignTemplate = {
  id: 'system-default-loan',
  agencyId: 'SYSTEM',
  name: 'System Default: Loan Collection',
  isDefault: true,
  fields: [
    { id: 'f1', name: 'Loan ID', type: 'text' },
    { id: 'f2', name: 'Due Amount', type: 'currency' },
    { id: 'f3', name: 'Due Date', type: 'date' }
  ],
  primaryFieldId: 'f1',
  secondaryFieldId: 'f2',
  actions: [
    { id: 'a1', label: 'Full Payment', color: 'bg-emerald-500', behavior: 'full_payment', showAmount: true, autoAmountFromDue: true, showNextDate: false, showNotes: true, showReceipt: true, showSelfie: true },
    { id: 'a2', label: 'Partial Payment', color: 'bg-brand-500', behavior: 'partial_payment', showAmount: true, autoAmountFromDue: false, showNextDate: true, showNotes: true, showReceipt: true, showSelfie: true },
    { id: 'a3', label: 'Promise to Pay', color: 'bg-orange-500', behavior: 'promise_to_pay', showAmount: false, autoAmountFromDue: false, showNextDate: true, showNotes: true, showReceipt: false, showSelfie: false },
    { id: 'a4', label: 'Not Reachable', color: 'bg-slate-500', behavior: 'visit', showAmount: false, autoAmountFromDue: false, showNextDate: false, showNotes: true, showReceipt: false, showSelfie: false },
    { id: 'a5', label: 'Wrong Address', color: 'bg-red-500', behavior: 'visit', showAmount: false, autoAmountFromDue: false, showNextDate: false, showNotes: true, showReceipt: false, showSelfie: false },
    { id: 'a6', label: 'Refused', color: 'bg-red-700', behavior: 'visit', showAmount: false, autoAmountFromDue: false, showNextDate: false, showNotes: true, showReceipt: false, showSelfie: false }
  ]
};

export default function CampaignBuilderScreen() {
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'builder'>('list');
  const [mobileTab, setMobileTab] = useState<'build' | 'preview'>('build');
  const [agencyId, setAgencyId] = useState<string | null>(null);

  const [campaigns, setCampaigns] = useState<CampaignTemplate[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [fields, setFields] = useState<CampaignField[]>([]);
  const [primaryFieldId, setPrimaryFieldId] = useState<string | undefined>();
  const [secondaryFieldId, setSecondaryFieldId] = useState<string | undefined>();
  const [actions, setActions] = useState<CampaignAction[]>([]);
  const [saving, setSaving] = useState(false);

  const [previewSelectedActionId, setPreviewSelectedActionId] = useState<string | null>(null);

  const isSystemDefault = editingCampaignId === 'system-default-loan';

  useEffect(() => {
    if (previewSelectedActionId && !actions.find(a => a.id === previewSelectedActionId)) {
      setPreviewSelectedActionId(null);
    }
  }, [actions, previewSelectedActionId]);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const rawAgencyId = await getUserAgencyId();
      const resolvedAgencyId = rawAgencyId || 'UNASSIGNED';
      setAgencyId(resolvedAgencyId);

      const campaignsRef = collection(db, 'campaigns');
      const q = query(campaignsRef, where('agencyId', '==', resolvedAgencyId));
      const snapshot = await getDocs(q);

      const loaded: CampaignTemplate[] = snapshot.docs.map((d) => ({
        id: d.id, ...(d.data() as any),
      }));

      loaded.sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return a.name.localeCompare(b.name);
      });

      // INJECT SYSTEM DEFAULT ALWAYS AT THE TOP
      setCampaigns([SYSTEM_DEFAULT_TEMPLATE, ...loaded]);
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, 'campaigns');
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const resetForm = () => {
    setEditingCampaignId(null); setName(''); setIsDefault(false);
    setFields([]); setPrimaryFieldId(undefined); setSecondaryFieldId(undefined);
    setActions([]); setPreviewSelectedActionId(null); setMobileTab('build');
  };

  const startNewCampaign = () => {
    resetForm(); setView('builder');
  };

  const loadCampaignToForm = (campaign: CampaignTemplate) => {
    setEditingCampaignId(campaign.id || null);
    setName(campaign.name);
    setIsDefault(!!campaign.isDefault);
    setFields(campaign.fields || []);
    setPrimaryFieldId(campaign.primaryFieldId);
    setSecondaryFieldId(campaign.secondaryFieldId);
    setActions(campaign.actions || []);
    setView('builder'); setMobileTab('build');
  };

  const addField = () => {
    if (isSystemDefault) return;
    setFields((prev) => [...prev, { id: `field_${Date.now()}`, name: '', type: 'text' }]);
  };

  const updateField = (id: string, patch: Partial<CampaignField>) => {
    if (isSystemDefault) return;
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const removeField = (id: string) => {
    if (isSystemDefault) return;
    setFields((prev) => prev.filter((f) => f.id !== id));
    setPrimaryFieldId((curr) => (curr === id ? undefined : curr));
    setSecondaryFieldId((curr) => (curr === id ? undefined : curr));
  };

  const addAction = () => {
    if (isSystemDefault) return;
    setActions((prev) => [...prev, {
      id: `action_${Date.now()}`, label: '', color: 'bg-slate-500', behavior: 'visit',
      showAmount: false, autoAmountFromDue: false, showNextDate: false, showNotes: true, showReceipt: false, showSelfie: false,
    }]);
  };

  const updateAction = (id: string, patch: Partial<CampaignAction>) => {
    if (isSystemDefault) return;
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const removeAction = (id: string) => {
    if (isSystemDefault) return;
    setActions((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSave = async () => {
    if (isSystemDefault) {
      alert("System templates cannot be modified. Please create a new template instead.");
      return;
    }
    if (!agencyId) return;
    if (!name.trim()) { alert('Campaign Name is required'); return; }

    setSaving(true);
    try {
      const payload: CampaignTemplate = {
        agencyId, name: name.trim(), isDefault, fields, primaryFieldId, secondaryFieldId, actions,
      };

      if (editingCampaignId) {
        await updateDoc(doc(db, 'campaigns', editingCampaignId), payload as any);
      } else {
        await addDoc(collection(db, 'campaigns'), payload as any);
      }

      await fetchCampaigns();
      setView('list'); resetForm();
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'campaigns');
    } finally {
      setSaving(false);
    }
  };

  if (view === 'list') {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-6 pb-24">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <LayoutTemplate className="text-brand-600" /> Workflow Templates
              </h1>
              <p className="text-sm text-slate-500 mt-1">Manage data schemas and agent collection workflows.</p>
            </div>
            <button onClick={startNewCampaign} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition font-medium shadow-sm w-full md:w-auto">
              <Plus size={18} /> New Template
            </button>
          </div>

          {loadingCampaigns ? (
            <div className="flex justify-center p-10"><span className="text-slate-400">Loading templates...</span></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaigns.map((c) => (
                <div 
                  key={c.id} 
                  onClick={() => loadCampaignToForm(c)}
                  className={cn(
                    "bg-white border rounded-2xl p-5 shadow-sm transition cursor-pointer active:scale-[0.98]",
                    c.id === 'system-default-loan' ? "border-amber-200 hover:border-amber-400 bg-amber-50/20" : "border-slate-200 hover:border-brand-300 hover:shadow-md"
                  )}
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-slate-900 text-lg leading-tight flex items-center gap-1">
                      {c.id === 'system-default-loan' && <Lock size={16} className="text-amber-500" />} {c.name}
                    </h3>
                    {c.isDefault && c.id !== 'system-default-loan' && (
                      <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md ml-2 shrink-0">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 text-sm text-slate-600 border-t border-slate-100 pt-3">
                    <span className="flex items-center gap-1"><Type size={14} className="text-slate-400"/> {c.fields?.length || 0} Fields</span>
                    <span className="flex items-center gap-1"><DollarSign size={14} className="text-slate-400"/> {c.actions?.length || 0} Actions</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const primaryField = fields.find(f => f.id === primaryFieldId);
  const secondaryField = fields.find(f => f.id === secondaryFieldId);
  const activePreviewAction = actions.find(a => a.id === previewSelectedActionId);
  const getMockData = (type: FieldType) => {
    if (type === 'currency') return '₹12,500';
    if (type === 'date') return '2026-10-15';
    return 'Sample Data';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-20 lg:pb-0">
      <div className="flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-30 p-4 border-b border-slate-200 shadow-sm">
        <button onClick={() => setView('list')} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium bg-slate-100 px-3 py-2 rounded-lg border border-slate-200 transition">
          <ArrowLeft size={18} /> <span className="hidden sm:inline">Back</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="lg:hidden flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button onClick={() => setMobileTab('build')} className={cn("px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-1", mobileTab === 'build' ? "bg-white text-brand-600 shadow-sm" : "text-slate-500")}>
              <Settings2 size={16} /> Build
            </button>
            <button onClick={() => setMobileTab('preview')} className={cn("px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-1", mobileTab === 'preview' ? "bg-white text-brand-600 shadow-sm" : "text-slate-500")}>
              <Eye size={16} /> Preview
            </button>
          </div>

          <button onClick={handleSave} disabled={saving || isSystemDefault} className="flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-md disabled:opacity-50 hover:bg-brand-700 transition">
            {saving ? 'Saving...' : 'Save'} <Save size={16} className="hidden sm:inline" />
          </button>
        </div>
      </div>

      <div className="max-w-350 w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        <div className={cn("lg:col-span-7 xl:col-span-8 space-y-6", mobileTab === 'preview' && 'hidden lg:block')}>
          
          {isSystemDefault && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex gap-3 shadow-sm">
              <Lock size={20} className="shrink-0 text-amber-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold">System Default Template (Read Only)</p>
                <p className="mt-1">This template provides the standard ProCollect loan features. It cannot be edited. If you want to customize your workflow, please go back and click <strong>"New Template"</strong>.</p>
              </div>
            </div>
          )}

          {!isSystemDefault && (
            <div className="bg-blue-50 border border-blue-100 text-blue-800 p-4 rounded-xl flex gap-3">
              <Info size={20} className="shrink-0 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold">How it works</p>
                <p>Configure the fields and actions below. The <strong>Live Preview</strong> shows exactly what your Field Agents will see when visiting a customer.</p>
              </div>
            </div>
          )}

          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Tag size={18} className="text-brand-500" /> 1. General Settings
            </h2>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Campaign Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={isSystemDefault} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none transition disabled:opacity-60 disabled:cursor-not-allowed" />
            </div>
            <label className={cn("flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl", isSystemDefault ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} disabled={isSystemDefault} className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:cursor-not-allowed" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-800">Set as Default Template</span>
                <span className="text-xs text-slate-500">Auto-selected during new data imports.</span>
              </div>
            </label>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Type size={18} className="text-brand-500" />
                <h2 className="text-base font-bold text-slate-800">2. Customer Fields</h2>
              </div>
              {!isSystemDefault && (
                <button onClick={addField} className="text-sm font-bold text-brand-600 flex items-center gap-1 bg-brand-50 px-3 py-1.5 rounded-lg hover:bg-brand-100">
                  <Plus size={16} /> Add Field
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500">Define the data points shown to agents in the app header and lists.</p>

            <div className="space-y-3">
              {fields.map((field) => (
                <div key={field.id} className="relative bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3 group">
                  {!isSystemDefault && (
                    <button type="button" onClick={() => removeField(field.id)} className="absolute top-3 right-3 text-slate-400 hover:text-red-500 bg-white p-1.5 rounded-md border border-slate-200 shadow-sm">
                      <Trash2 size={16} />
                    </button>
                  )}
                  <div className="pr-10 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Field Name (Label)</label>
                      <input type="text" value={field.name} onChange={(e) => updateField(field.id, { name: e.target.value })} disabled={isSystemDefault} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none disabled:opacity-60 disabled:bg-slate-50" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Type</label>
                      <select value={field.type} onChange={(e) => updateField(field.id, { type: e.target.value as FieldType })} disabled={isSystemDefault} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none disabled:opacity-60 disabled:bg-slate-50">
                        {FIELD_TYPE_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-200 mt-1">
                    <label className={cn("flex items-center gap-2", isSystemDefault ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
                      <input type="radio" name="primaryField" checked={primaryFieldId === field.id} onChange={() => setPrimaryFieldId(field.id)} disabled={isSystemDefault} className="w-4 h-4 text-brand-600 focus:ring-brand-500 border-slate-300" />
                      <span className="text-xs font-semibold text-slate-700">Display as Primary Title</span>
                    </label>
                    <label className={cn("flex items-center gap-2", isSystemDefault ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
                      <input type="radio" name="secondaryField" checked={secondaryFieldId === field.id} onChange={() => setSecondaryFieldId(field.id)} disabled={isSystemDefault} className="w-4 h-4 text-brand-600 focus:ring-brand-500 border-slate-300" />
                      <span className="text-xs font-semibold text-slate-700">Display as Subtitle</span>
                    </label>
                  </div>
                </div>
              ))}
              {fields.length === 0 && (
                <div className="text-center py-8 text-sm text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                  No custom fields defined. Click "Add Field".
                </div>
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <DollarSign size={18} className="text-brand-500" />
                <h2 className="text-base font-bold text-slate-800">3. Agent Actions & Proof</h2>
              </div>
              {!isSystemDefault && (
                <button onClick={addAction} className="text-sm font-bold text-brand-600 flex items-center gap-1 bg-brand-50 px-3 py-1.5 rounded-lg hover:bg-brand-100">
                  <Plus size={16} /> Add Action
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500">Configure what agents can submit (e.g. "Full Payment", "Not Found") and toggle what proof is required.</p>

            <div className="space-y-4">
              {actions.map((action) => (
                <div key={action.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200 shadow-sm relative">
                  {!isSystemDefault && (
                    <button type="button" onClick={() => removeAction(action.id)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 bg-white p-1.5 rounded-md border border-slate-200 shadow-sm">
                      <Trash2 size={16} />
                    </button>
                  )}

                  <div className="pr-10 grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Button Label (Status)</label>
                      <input type="text" value={action.label} onChange={(e) => updateAction(action.id, { label: e.target.value })} disabled={isSystemDefault} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none disabled:opacity-60 disabled:bg-slate-50" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">System Logic</label>
                      <select value={action.behavior} onChange={(e) => updateAction(action.id, { behavior: e.target.value as ActionBehavior })} disabled={isSystemDefault} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none disabled:opacity-60 disabled:bg-slate-50">
                        {ACTION_BEHAVIOR_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                      </select>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 items-center gap-1">
                      <Palette size={12} /> Button Color
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_PRESETS.map((cls) => (
                        <button key={cls} type="button" disabled={isSystemDefault} onClick={() => updateAction(action.id, { color: cls })} className={cn("w-8 h-8 rounded-full border-2 transition-all", action.color === cls ? "border-white ring-2 ring-brand-500 scale-110 shadow-md" : "border-transparent opacity-80", isSystemDefault ? "cursor-not-allowed opacity-50" : "hover:opacity-100 hover:scale-105", cls)} />
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 border-b border-slate-100 pb-1">When agent selects this action, they MUST provide:</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-2 pt-1">
                      <ToggleCheckbox disabled={isSystemDefault} label="Amount Entry" checked={action.showAmount} onChange={(v) => updateAction(action.id, { showAmount: v })} />
                      {action.showAmount && (<ToggleCheckbox disabled={isSystemDefault} label="Auto-fill Due" checked={action.autoAmountFromDue} onChange={(v) => updateAction(action.id, { autoAmountFromDue: v })} />)}
                      <ToggleCheckbox disabled={isSystemDefault} label="Next Follow-up" checked={action.showNextDate} onChange={(v) => updateAction(action.id, { showNextDate: v })} />
                      <ToggleCheckbox disabled={isSystemDefault} label="Visit Notes" checked={action.showNotes} onChange={(v) => updateAction(action.id, { showNotes: v })} />
                      <ToggleCheckbox disabled={isSystemDefault} label="Receipt Photo" checked={action.showReceipt} onChange={(v) => updateAction(action.id, { showReceipt: v })} />
                      <ToggleCheckbox disabled={isSystemDefault} label="Location Selfie" checked={action.showSelfie} onChange={(v) => updateAction(action.id, { showSelfie: v })} />
                    </div>
                  </div>
                </div>
              ))}
              {actions.length === 0 && (
                <div className="text-center py-8 text-sm text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                  No actions defined. Agents won't be able to submit updates.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className={cn("lg:col-span-5 xl:col-span-4", mobileTab === 'build' && 'hidden lg:block')}>
          <div className="lg:sticky lg:top-24">
            
            <div className="flex items-center justify-between mb-3 px-2">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Smartphone className="text-brand-500" size={20} /> Agent App Preview
              </h3>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full animate-pulse flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Live Update
              </span>
            </div>

            <div className="mx-auto w-full max-w-85 h-175 bg-slate-900 rounded-[3rem] p-3 shadow-2xl relative border-4 border-slate-800 flex flex-col">
              <div className="absolute top-3 left-1/2 -translate-x-1/2 h-5 w-32 bg-black rounded-b-2xl z-50 flex items-center justify-center gap-2">
                <div className="w-1 h-1 rounded-full bg-slate-700"></div>
                <div className="w-12 h-1 rounded-full bg-slate-800"></div>
              </div>
              <div className="bg-slate-50 flex-1 rounded-[2.2rem] overflow-y-auto overflow-x-hidden relative flex flex-col webkit-scrollbar-hide pb-6">
                
                <div className="bg-brand-600 text-white p-5 pt-10 rounded-b-4xl shadow-md shrink-0">
                  <div className="flex items-center gap-2 text-brand-100 text-[10px] font-bold uppercase tracking-widest mb-4">
                    <ChevronLeft size={14} /> Back
                  </div>
                  <h1 className="text-xl font-bold leading-tight">
                    {primaryField ? primaryField.name + " (Sample)" : "Customer Name"}
                  </h1>
                  <p className="text-brand-100 text-xs mt-1 bg-black/10 inline-block px-2 py-0.5 rounded text-[10px]">
                    {secondaryField ? `${secondaryField.name}: ${getMockData(secondaryField.type)}` : 'ID: 123456 • 9876543210'}
                  </p>
                  <div className="mt-5 flex justify-between items-end">
                    <div>
                      <span className="text-brand-300 text-[9px] font-bold uppercase tracking-widest">Outstanding</span>
                      <div className="text-2xl font-black">₹25,000</div>
                    </div>
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col gap-5">
                  <div>
                    <h2 className="text-sm font-bold text-slate-800 mb-3">Update Status</h2>
                    <div className="grid grid-cols-2 gap-2">
                      {actions.length === 0 && (
                        <div className="col-span-2 text-center py-4 border border-dashed border-slate-300 rounded-xl text-xs text-slate-400">
                          Add actions on the left
                        </div>
                      )}
                      {actions.map((status) => (
                        <button
                          key={status.id}
                          onClick={() => setPreviewSelectedActionId(status.id)}
                          className={cn(
                            'p-3 rounded-2xl border-2 flex flex-col items-start space-y-1.5 transition-all text-left',
                            previewSelectedActionId === status.id ? 'bg-white border-brand-500 shadow-md' : 'bg-white border-transparent shadow-sm text-slate-500'
                          )}
                        >
                          <div className={cn('w-2 h-2 rounded-full shadow-sm', status.color)} />
                          <span className={cn('text-[10px] font-bold uppercase tracking-tight line-clamp-2 leading-snug', previewSelectedActionId === status.id ? 'text-brand-600' : 'text-slate-600')}>
                            {status.label || 'Action'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {activePreviewAction && (
                      <motion.div
                        key={activePreviewAction.id}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                          {activePreviewAction.showAmount && (
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Amount Collected</label>
                              <div className="relative mt-1">
                                <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <div className="w-full bg-slate-50 rounded-xl p-2.5 pl-8 text-sm font-bold text-slate-700 border border-slate-100">
                                  {activePreviewAction.autoAmountFromDue ? '25000' : '0.00'}
                                </div>
                              </div>
                            </div>
                          )}
                          {activePreviewAction.showNextDate && (
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Next Follow-up Date</label>
                              <div className="relative mt-1">
                                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <div className="w-full bg-slate-50 rounded-xl p-2.5 pl-8 text-sm font-bold text-slate-400 border border-slate-100">
                                  dd/mm/yyyy
                                </div>
                              </div>
                            </div>
                          )}
                          {activePreviewAction.showNotes && (
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Visit Notes</label>
                              <div className="w-full bg-slate-50 rounded-xl p-2.5 h-16 text-xs text-slate-400 border border-slate-100 mt-1">
                                Remarks...
                              </div>
                            </div>
                          )}
                          {(activePreviewAction.showReceipt || activePreviewAction.showSelfie) && (
                            <div className="grid grid-cols-2 gap-2">
                              {activePreviewAction.showReceipt && (
                                <div className="bg-slate-50 rounded-xl h-16 flex flex-col items-center justify-center text-slate-400 border border-slate-100"><Camera size={16} /><span className="text-[8px] font-bold uppercase mt-1">Receipt</span></div>
                              )}
                              {activePreviewAction.showSelfie && (
                                <div className="bg-slate-50 rounded-xl h-16 flex flex-col items-center justify-center text-slate-400 border border-slate-100"><Camera size={16} /><span className="text-[8px] font-bold uppercase mt-1">Selfie</span></div>
                              )}
                            </div>
                          )}
                          <div className="w-full bg-brand-600 text-white p-3 rounded-xl font-bold flex items-center justify-center space-x-1.5 text-xs shadow-md mt-2">
                            <CheckCircle2 size={16} /><span>Submit</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

function ToggleCheckbox({ label, checked, onChange, disabled }: { label: string, checked: boolean, disabled?: boolean, onChange: (val: boolean) => void }) {
  return (
    <label className={cn("flex items-center gap-2 group", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
      <div className={cn("w-5 h-5 rounded flex items-center justify-center transition-colors border shrink-0", checked ? "bg-brand-500 border-brand-500" : "bg-slate-50 border-slate-300 group-hover:border-brand-400")}>
        {checked && <CheckCircle2 size={14} className="text-white" />}
      </div>
      <span className="text-[11px] font-bold text-slate-600 leading-tight">{label}</span>
      <input type="checkbox" className="hidden" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}