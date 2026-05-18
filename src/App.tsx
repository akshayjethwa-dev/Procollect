/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
// FIX: Imported onSnapshot, removed getIdTokenResult and getDoc
import { auth, User, db, doc, onSnapshot } from './lib/firebase';

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

import AgentManagementScreen from './screens/Admin/AgentManagementScreen';
import SubmitDepositScreen from './screens/SubmitDepositScreen';
import PendingDepositsScreen from './screens/Admin/PendingDepositsScreen';
import AgentDetailScreen from './screens/Admin/AgentDetailScreen';
import DepositHistoryScreen from './screens/DepositHistoryScreen';
import { Shield, Users, LogOut, Wallet, Menu } from 'lucide-react';
import { cn } from './lib/utils';

const AdminLayout = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar for desktop */}
      <aside className="w-64 bg-slate-900 text-white hidden md:flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield size={20} className="text-blue-400" /> Manager Portal
          </h2>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link to="/admin/dashboard" className="block px-4 py-2 rounded hover:bg-slate-800 transition">
            Dashboard
          </Link>
          <Link
            to="/admin/deposits"
            className="flex items-center justify-between px-4 py-2 rounded hover:bg-slate-800 transition group"
          >
            <span className="flex items-center gap-2">
              <Wallet size={18} className="text-emerald-400" /> Deposits
            </span>
          </Link>
          <Link
            to="/admin/agents"
            className="flex items-center gap-2 px-4 py-2 rounded hover:bg-slate-800 transition"
          >
            <Users size={18} className="text-blue-400" /> Manage Agents
          </Link>
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={() => auth.signOut()}
            className="flex items-center gap-2 px-4 py-2 text-red-400 hover:text-red-300 w-full"
          >
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      {/* Mobile header + slide-over menu */}
      <div className="flex-1 flex flex-col md:ml-0">
        <header className="md:hidden sticky top-0 z-30 bg-slate-900 text-white flex items-center justify-between px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-blue-400" />
            <span className="font-semibold text-sm">Manager Portal</span>
          </div>
          <button
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 active:scale-95 transition-transform"
            aria-label="Toggle menu"
          >
            <Menu size={20} />
          </button>
        </header>

        {/* Mobile menu sheet */}
        <div
          className={cn(
            'md:hidden fixed inset-0 z-20 transition-opacity',
            isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          )}
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="absolute top-0 left-0 bottom-0 w-64 bg-slate-900 text-white shadow-xl flex flex-col">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={20} className="text-blue-400" />
                <span className="font-semibold text-sm">Manager Menu</span>
              </div>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="p-1 rounded-full hover:bg-slate-800"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-2 text-sm">
              <Link
                to="/admin/dashboard"
                onClick={() => setIsMenuOpen(false)}
                className="block px-3 py-2 rounded-lg hover:bg-slate-800 transition"
              >
                Dashboard
              </Link>
              <Link
                to="/admin/deposits"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800 transition"
              >
                <span className="flex items-center gap-2">
                  <Wallet size={18} className="text-emerald-400" /> Deposits
                </span>
              </Link>
              <Link
                to="/admin/agents"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-800 transition"
              >
                <Users size={18} className="text-blue-400" /> Manage Agents
              </Link>
            </nav>
            <div className="p-4 border-t border-slate-800">
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  auth.signOut();
                }}
                className="flex items-center gap-2 px-4 py-2 text-red-400 hover:text-red-300 w-full text-sm"
              >
                <LogOut size={18} /> Logout
              </button>
            </div>
          </div>
        </div>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const AdminDashboardScreen = () => (
  <div className="p-4 md:p-8 font-bold text-xl md:text-2xl text-gray-800">
    Manager Dashboard
  </div>
);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'agency_manager' | 'agent' | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;

    const unsubAuth = auth.onAuthStateChanged((u) => {
      if (u) {
        setUser(u);

        // FIX: Use a real-time listener on the user doc.
        // If you change the role in Firestore, the app updates instantly.
        unsubscribeDoc = onSnapshot(
          doc(db, 'users', u.uid),
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              // Check for both just in case it was typed as 'admin' in the database
              if (data.role === 'agency_manager' || data.role === 'admin') {
                setUserRole('agency_manager');
              } else {
                setUserRole('agent');
              }
            } else {
              // Doc hasn't been created by LoginScreen yet, assume agent for now
              setUserRole('agent');
            }
            setLoading(false);
          },
          (error) => {
            console.error('Error listening to user role:', error);
            setUserRole('agent');
            setLoading(false);
          }
        );
      } else {
        setUser(null);
        setUserRole(null);
        setLoading(false);
        if (unsubscribeDoc) unsubscribeDoc();
      }
    });

    const timer = setTimeout(() => setShowSplash(false), 2500);

    return () => {
      unsubAuth();
      if (unsubscribeDoc) unsubscribeDoc();
      clearTimeout(timer);
    };
  }, []);

  if (showSplash) return <SplashScreen />;
  // Don't render routes until we know the role
  if (loading) return null;

  const getInitialRoute = () => {
    return userRole === 'agency_manager' ? '/admin/dashboard' : '/dashboard';
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={!user ? <LoginScreen /> : <Navigate to={getInitialRoute()} />}
        />
        <Route
          path="/signup"
          element={!user ? <SignupScreen /> : <Navigate to={getInitialRoute()} />}
        />
        <Route
          path="/"
          element={user ? <Navigate to={getInitialRoute()} /> : <Navigate to="/login" />}
        />

        {/* MANAGER ROUTES */}
        {userRole === 'agency_manager' && (
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" />} />
            <Route path="dashboard" element={<AdminDashboardScreen />} />
            <Route path="agents" element={<AgentManagementScreen />} />
            <Route path="agents/:id" element={<AgentDetailScreen />} />
            <Route path="deposits" element={<PendingDepositsScreen />} />
            <Route path="*" element={<Navigate to="dashboard" />} />
          </Route>
        )}

        {/* AGENT ROUTES */}
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
            <Route path="submit-deposit" element={<SubmitDepositScreen />} />
            <Route path="deposit-history" element={<DepositHistoryScreen />} />
            <Route path="*" element={<Navigate to="dashboard" />} />
          </Route>
        )}

        <Route
          path="*"
          element={<Navigate to={user ? getInitialRoute() : '/login'} />}
        />
      </Routes>
    </BrowserRouter>
  );
}