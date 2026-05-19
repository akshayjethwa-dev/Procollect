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

import ManagerDashboardScreen from './screens/Admin/ManagerDashboardScreen';
import AgentManagementScreen from './screens/Admin/AgentManagementScreen';
import SubmitDepositScreen from './screens/SubmitDepositScreen';
import PendingDepositsScreen from './screens/Admin/PendingDepositsScreen';
import AgentDetailScreen from './screens/Admin/AgentDetailScreen';
import DepositHistoryScreen from './screens/DepositHistoryScreen';
import LiveMapScreen from './screens/Admin/LiveMapScreen';
import { Shield, Users, LogOut, Wallet, Menu, ChevronRight, MapPin, Home } from 'lucide-react';
import { cn } from './lib/utils';

// Accept userRole as a prop
const AdminLayout = ({ userRole }: { userRole: string | null }) => {
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

            {/* NEW: Switch Button for Independent Agents */}
            {userRole === 'independent_agent' && (
              <div className="pt-4 mt-4 border-t border-slate-800">
                <Link
                  to="/dashboard"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 bg-blue-900/40 text-blue-300 rounded-xl hover:bg-blue-800/50 transition font-medium border border-blue-800/30"
                >
                  <Home size={18} /> Switch to Field App
                </Link>
              </div>
            )}
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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  // Expand Role State
  const [userRole, setUserRole] = useState<'agency_manager' | 'independent_agent' | 'agent' | null>(null);
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
              // Classify role accurately
              if (data.role === 'agency_manager' || data.role === 'admin') {
                setUserRole('agency_manager');
              } else if (data.role === 'independent_agent') {
                setUserRole('independent_agent');
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
    if (userRole === 'agency_manager') return '/admin/dashboard';
    if (userRole === 'independent_agent') return '/admin/dashboard'; // Default land them in manager portal
    return '/dashboard';
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user ? <LoginScreen /> : <Navigate to={getInitialRoute()} />} />
        <Route path="/signup" element={!user ? <SignupScreen /> : <Navigate to={getInitialRoute()} />} />
        <Route path="/" element={user ? <Navigate to={getInitialRoute()} /> : <Navigate to="/login" />} />

        {/* MANAGER & INDEPENDENT AGENT ROUTES */}
        {(userRole === 'agency_manager' || userRole === 'independent_agent') && (
          <Route path="/admin" element={<AdminLayout userRole={userRole} />}>
            <Route index element={<Navigate to="dashboard" />} />
            <Route path="dashboard" element={<ManagerDashboardScreen />} />
            <Route path="agents" element={<AgentManagementScreen />} />
            <Route path="agents/:id" element={<AgentDetailScreen />} />
            <Route path="deposits" element={<PendingDepositsScreen />} />
            <Route path="map" element={<LiveMapScreen />} />
            <Route path="*" element={<Navigate to="dashboard" />} />
          </Route>
        )}

        {/* AGENT & INDEPENDENT AGENT ROUTES */}
        {/* Notice we pass userRole to Layout so we can show the top banner */}
        {(userRole === 'agent' || userRole === 'independent_agent') && (
          <Route path="/" element={<Layout userRole={userRole} />}>
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