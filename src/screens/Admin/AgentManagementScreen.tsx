import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, auth, getUserAgencyId } from '../../lib/firebase';
import { UserPlus, Key, Shield, CheckCircle2, Wallet, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AgentManagementScreen() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newCredentials, setNewCredentials] = useState<{email: string, pass: string} | null>(null);

  const [resetModalId, setResetModalId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const functions = getFunctions(auth.app);

  const fetchAgents = async (user: any) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const agencyId = await getUserAgencyId() || user.uid;
      const q = query(
        collection(db, 'users'), 
        where('role', '==', 'agent'),
        where('agencyId', '==', agencyId)
      );
      const snapshot = await getDocs(q);
      const agentsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAgents(agentsList);
    } catch (error: any) {
      console.error("Error fetching agents", error);
      if (error.message.includes('index')) {
        setErrorMsg('Firestore indexing required. Check your browser console for the link to build the index.');
      } else {
        setErrorMsg('Failed to load agents. Make sure you have the right permissions.');
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) fetchAgents(user);
      else { setAgents([]); setLoading(false); }
    });
    return () => unsubscribeAuth();
  }, []);

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return alert("You must be logged in.");
    
    setIsSubmitting(true);
    try {
      const agencyId = await getUserAgencyId() || auth.currentUser.uid;
      const createAgentFn = httpsCallable(functions, 'createAgentAccount');
      const result = await createAgentFn({ name, phone, password, agencyId });
      
      const data = result.data as any;
      setNewCredentials({ email: data.email, pass: password });
      
      setName(''); setPhone(''); setPassword('');
      fetchAgents(auth.currentUser);
    } catch (error: any) {
      alert("Error: " + error.message);
    }
    setIsSubmitting(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const resetFn = httpsCallable(functions, 'resetAgentPassword');
      await resetFn({ uid: resetModalId, newPassword });
      alert("Password reset successfully!");
      setResetModalId(null);
      setNewPassword('');
    } catch (error: any) {
      alert("Error: " + error.message);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      
      {/* Mobile Back Button */}
      <div className="md:hidden">
        <Link to="/admin/dashboard" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold text-sm bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm transition-colors active:scale-95">
          <ArrowLeft size={16} /> Dashboard
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Shield className="text-blue-600" />
          Agent Provisioning
        </h1>
        <button 
          onClick={() => { setShowCreateModal(true); setNewCredentials(null); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 md:py-2 rounded-xl md:rounded-lg flex items-center justify-center gap-2 font-medium w-full md:w-auto shadow-sm active:scale-95 transition-transform"
        >
          <UserPlus size={18} /> Add New Agent
        </button>
      </div>

      {errorMsg && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-semibold border border-red-100">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading your agents...</p>
      ) : (
        <>
          {/* DESKTOP TABLE VIEW */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm">
                    <th className="p-4 font-medium">Agent Name</th>
                    <th className="p-4 font-medium">System ID (Login Email)</th>
                    <th className="p-4 font-medium">Phone</th>
                    <th className="p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {agents.map((agent) => (
                    <tr key={agent.id} className="hover:bg-gray-50/50">
                      <td className="p-4 font-medium text-gray-800">
                        <Link to={`/admin/agents/${agent.id}`} className="hover:text-blue-600 transition-colors">
                          {agent.name}
                        </Link>
                      </td>
                      <td className="p-4 text-blue-600">{agent.email}</td>
                      <td className="p-4 text-gray-600">{agent.phone}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <Link 
                            to={`/admin/agents/${agent.id}`}
                            className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1 font-medium bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 transition-colors"
                          >
                            <Wallet size={16} /> View Ledger
                          </Link>

                          <button 
                            onClick={() => setResetModalId(agent.id)}
                            className="text-gray-500 hover:text-blue-600 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                          >
                            <Key size={16} /> Reset Password
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {agents.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-gray-500">
                        No agents found in your agency.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* MOBILE CARDS VIEW */}
          <div className="md:hidden space-y-4">
            {agents.map((agent) => (
              <div key={agent.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div>
                    <Link to={`/admin/agents/${agent.id}`} className="font-bold text-lg text-blue-600 block">
                      {agent.name}
                    </Link>
                    <span className="text-sm text-slate-500 break-all">{agent.email}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1.5 rounded-lg">{agent.phone}</span>
                </div>
                
                <div className="flex flex-col gap-3 pt-3 border-t border-slate-100">
                  <Link 
                    to={`/admin/agents/${agent.id}`}
                    className="w-full text-emerald-600 flex justify-center items-center gap-2 font-bold bg-emerald-50 hover:bg-emerald-100 px-4 py-3 rounded-xl transition-colors"
                  >
                    <Wallet size={18} /> View Ledger
                  </Link>
                  <button 
                    onClick={() => setResetModalId(agent.id)}
                    className="w-full text-slate-600 flex justify-center items-center gap-2 font-bold bg-slate-50 hover:bg-slate-100 px-4 py-3 rounded-xl border border-slate-200 transition-colors"
                  >
                    <Key size={18} /> Reset Password
                  </button>
                </div>
              </div>
            ))}
            {agents.length === 0 && (
              <div className="text-center p-8 bg-white rounded-2xl border border-slate-200 text-slate-500 shadow-sm">
                No agents found in your agency.
              </div>
            )}
          </div>
        </>
      )}

      {/* --- CREATE MODAL --- */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4">Create Agent Account</h2>
            
            {newCredentials ? (
              <div className="bg-emerald-50 text-emerald-900 border border-emerald-200 p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2 font-bold text-emerald-700">
                  <CheckCircle2 /> Provisioning Successful!
                </div>
                <p className="text-sm">Please securely share these login details with your agent.</p>
                <div className="bg-white p-3 rounded-lg border border-emerald-100 font-mono text-sm space-y-1">
                  <p><strong>Login Email:</strong> {newCredentials.email}</p>
                  <p><strong>Password:</strong> {newCredentials.pass}</p>
                </div>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 mt-2 transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateAgent} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                    placeholder="e.g. Ramesh Patel"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Temporary Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                    minLength={6}
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 text-slate-600 bg-slate-100 hover:bg-slate-200 py-3 rounded-xl font-bold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl shadow font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Account'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* --- RESET PASSWORD MODAL --- */}
      {resetModalId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4">Reset Password</h2>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                  minLength={6}
                  placeholder="Enter new password"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalId(null)}
                  className="flex-1 text-slate-600 bg-slate-100 hover:bg-slate-200 py-3 rounded-xl font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl shadow font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Updating...' : 'Force Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}