/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { auth, User, getIdTokenResult, db, doc, getDoc } from './lib/firebase';

import SplashScreen from './screens/SplashScreen';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import DashboardScreen from './screens/DashboardScreen';
import CustomerListScreen from './screens/CustomerListScreen';
import ImportScreen from './screens/ImportScreen';
import ProfileScreen from './screens/ProfileScreen';
import CollectionUpdateScreen from './screens/CollectionUpdateScreen';
import MembershipScreen from './screens/MembershipScreen';
import ReportsScreen from './screens/ReportsScreen';
import FollowUpScreen from './screens/FollowUpScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import CheckoutScreen from './screens/CheckoutScreen';
import Layout from './components/Layout';

// NEW IMPORTS
import AgentManagementScreen from './screens/Admin/AgentManagementScreen';
import { Shield, Users, LogOut } from 'lucide-react';

// Basic Admin Layout implementation for Manager navigation
const AdminLayout = () => (
  <div className="min-h-screen bg-gray-50 flex">
    {/* Admin Sidebar */}
    <aside className="w-64 bg-slate-900 text-white hidden md:flex flex-col">
      <div className="p-6 border-b border-slate-800">
        <h2 className="text-xl font-bold flex items-center gap-2"><Shield size={20} className="text-blue-400" /> Manager Portal</h2>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <Link to="/admin/dashboard" className="block px-4 py-2 rounded hover:bg-slate-800 transition">Dashboard</Link>
        <Link to="/admin/agents" className="flex items-center gap-2 px-4 py-2 rounded hover:bg-slate-800 transition"><Users size={18} /> Manage Agents</Link>
      </nav>
      <div className="p-4 border-t border-slate-800">
        <button onClick={() => auth.signOut()} className="flex items-center gap-2 px-4 py-2 text-red-400 hover:text-red-300 w-full">
          <LogOut size={18} /> Logout
        </button>
      </div>
    </aside>
    {/* Main Content */}
    <main className="flex-1 overflow-auto">
      <Outlet />
    </main>
  </div>
);

const AdminDashboardScreen = () => <div className="p-8 font-bold text-2xl text-gray-800">Manager Dashboard</div>;

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'manager' | 'agent' | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (u) {
        try {
          const tokenResult = await getIdTokenResult(u);
          let role = tokenResult.claims.role as 'manager' | 'agent' | undefined;

          if (!role) {
            const userDoc = await getDoc(doc(db, 'users', u.uid));
            if (userDoc.exists()) {
              role = userDoc.data().role;
            }
          }

          setUserRole(role || 'agent'); 
          setUser(u);
        } catch (error) {
          console.error("Error fetching user role:", error);
          setUserRole('agent');
          setUser(u);
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });
    
    const timer = setTimeout(() => setShowSplash(false), 2500);
    
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);

  if (showSplash) return <SplashScreen />;
  if (loading) return null;

  const getInitialRoute = () => {
    return userRole === 'manager' ? '/admin/dashboard' : '/dashboard';
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user ? <LoginScreen /> : <Navigate to={getInitialRoute()} />} />
        <Route path="/signup" element={!user ? <SignupScreen /> : <Navigate to={getInitialRoute()} />} />
        <Route path="/" element={user ? <Navigate to={getInitialRoute()} /> : <Navigate to="/login" />} />

        {/* ========================================== */}
        {/* MANAGER ROUTES (AdminLayout)               */}
        {/* ========================================== */}
        {userRole === 'manager' && (
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" />} />
            <Route path="dashboard" element={<AdminDashboardScreen />} />
            {/* NEW: Agent Management Route added here */}
            <Route path="agents" element={<AgentManagementScreen />} />
            <Route path="*" element={<Navigate to="dashboard" />} />
          </Route>
        )}

        {/* ========================================== */}
        {/* AGENT ROUTES (Standard Layout)             */}
        {/* ========================================== */}
        {userRole === 'agent' && (
          <Route path="/" element={<Layout />}> 
            <Route index element={<Navigate to="dashboard" />} />
            <Route path="dashboard" element={<DashboardScreen />} />
            <Route path="customers" element={<CustomerListScreen />} />
            <Route path="customers/:id" element={<CollectionUpdateScreen />} />
            <Route path="import" element={<ImportScreen />} />
            <Route path="profile" element={<ProfileScreen />} />
            <Route path="membership" element={<MembershipScreen />} />
            <Route path="reports" element={<ReportsScreen />} />
            <Route path="followups" element={<FollowUpScreen />} />
            <Route path="notifications" element={<NotificationsScreen />} />
            <Route path="checkout" element={<CheckoutScreen />} />
            <Route path="*" element={<Navigate to="dashboard" />} />
          </Route>
        )}

        {/* Catch-All / Security Fallback */}
        <Route path="*" element={<Navigate to={user ? getInitialRoute() : "/login"} />} />
      </Routes>
    </BrowserRouter>
  );
}