/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
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
import LiveMapScreen from './screens/Admin/LiveMapScreen';
import { Shield, Users, LogOut, Wallet, Menu, ChevronRight, MapPin } from 'lucide-react';
import { cn } from './lib/utils';

const AdminLayout = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      
      {/* Universal Top Header */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white flex items-center justify-between px-4 py-3 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMenuOpen(true)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 transition-transform"
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-blue-400" />
            <span className="font-semibold text-lg">Manager Portal</span>
          </div>
        </div>
      </header>

      {/* Slide-out Drawer (Hidden by default) */}
      <div
        className={cn(
          'fixed inset-0 z-50 transition-opacity duration-300',
          isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        {/* Dark Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsMenuOpen(false)}
        />
        
        {/* Sidebar Panel */}
        <div
          className={cn(
            "absolute top-0 left-0 bottom-0 w-64 bg-slate-900 text-white shadow-2xl flex flex-col transition-transform duration-300",
            isMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={20} className="text-blue-400" />
              <span className="font-semibold text-sm">Navigation</span>
            </div>
            <button
              onClick={() => setIsMenuOpen(false)}
              className="p-2 rounded-full hover:bg-slate-800 bg-slate-800/50"
            >
              ✕
            </button>
          </div>
          <nav className="flex-1 p-4 space-y-2 text-sm overflow-y-auto">
            <Link
              to="/admin/dashboard"
              onClick={() => setIsMenuOpen(false)}
              className="block px-4 py-3 rounded-xl hover:bg-slate-800 transition font-medium"
            >
              Dashboard
            </Link>
            <Link
              to="/admin/map"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition font-medium"
            >
              <MapPin size={18} className="text-purple-400" /> Live Tracker
            </Link>
            <Link
              to="/admin/deposits"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition font-medium"
            >
              <Wallet size={18} className="text-emerald-400" /> Pending Deposits
            </Link>
            <Link
              to="/admin/agents"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition font-medium"
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
              className="flex items-center gap-2 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-xl w-full text-sm font-medium transition"
            >
              <LogOut size={18} /> Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 pb-10">
        <Outlet />
      </main>
    </div>
  );
};

const AdminDashboardScreen = () => (
  <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
    <div>
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Manager Dashboard</h1>
      <p className="text-slate-500 mt-2 font-medium">Welcome to the manager portal. Select an option below to get started.</p>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
      <Link 
        to="/admin/agents" 
        className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between hover:shadow-md transition active:scale-[0.98]"
      >
        <div className="flex items-center gap-4">
          <div className="bg-blue-50 p-4 rounded-xl text-blue-600">
            <Users size={28} />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-800">Manage Agents</h3>
            <p className="text-sm text-slate-500 font-medium">Add, edit, or remove collection agents</p>
          </div>
        </div>
        <ChevronRight className="text-slate-400" />
      </Link>

      <Link 
        to="/admin/deposits" 
        className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between hover:shadow-md transition active:scale-[0.98]"
      >
        <div className="flex items-center gap-4">
          <div className="bg-emerald-50 p-4 rounded-xl text-emerald-600">
            <Wallet size={28} />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-800">Pending Deposits</h3>
            <p className="text-sm text-slate-500 font-medium">Review and reconcile cash handovers</p>
          </div>
        </div>
        <ChevronRight className="text-slate-400" />
      </Link>
    </div>
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

        unsubscribeDoc = onSnapshot(
          doc(db, 'users', u.uid),
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              if (data.role === 'agency_manager' || data.role === 'admin') {
                setUserRole('agency_manager');
              } else {
                setUserRole('agent');
              }
            } else {
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
  if (loading) return null;

  const getInitialRoute = () => {
    return userRole === 'agency_manager' ? '/admin/dashboard' : '/dashboard';
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user ? <LoginScreen /> : <Navigate to={getInitialRoute()} />} />
        <Route path="/signup" element={!user ? <SignupScreen /> : <Navigate to={getInitialRoute()} />} />
        <Route path="/" element={user ? <Navigate to={getInitialRoute()} /> : <Navigate to="/login" />} />

        {/* MANAGER ROUTES */}
        {userRole === 'agency_manager' && (
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" />} />
            <Route path="dashboard" element={<AdminDashboardScreen />} />
            <Route path="agents" element={<AgentManagementScreen />} />
            <Route path="agents/:id" element={<AgentDetailScreen />} />
            <Route path="deposits" element={<PendingDepositsScreen />} />
            <Route path="map" element={<LiveMapScreen />} />
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

        <Route path="*" element={<Navigate to={user ? getInitialRoute() : '/login'} />} />
      </Routes>
    </BrowserRouter>
  );
}