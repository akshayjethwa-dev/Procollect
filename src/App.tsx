/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { auth, User, getIdTokenResult, db, doc, getDoc } from './lib/firebase';

import SplashScreen from './screens/SplashScreen';
import LoginScreen from './screens/LoginScreen';
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

// Placeholder Admin components
const AdminLayout = () => <div className="admin-layout"><Outlet /></div>;
const AdminDashboardScreen = () => <div className="p-8 font-bold text-2xl">Manager Dashboard</div>;

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'manager' | 'agent' | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (u) {
        try {
          // 1. Decode token to check for secure custom claims
          const tokenResult = await getIdTokenResult(u);
          let role = tokenResult.claims.role as 'manager' | 'agent' | undefined;

          // 2. Dev Fallback: If no claim is found, check Firestore database
          if (!role) {
            const userDoc = await getDoc(doc(db, 'users', u.uid));
            if (userDoc.exists()) {
              role = userDoc.data().role;
            }
          }

          setUserRole(role || 'agent'); // Default to agent if undefined
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

  // FIXED: Standard agents are routed to '/dashboard', matching your Layout links
  const getInitialRoute = () => {
    return userRole === 'manager' ? '/admin/dashboard' : '/dashboard';
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={!user ? <LoginScreen /> : <Navigate to={getInitialRoute()} />} />
        
        {/* Root Redirect */}
        <Route path="/" element={user ? <Navigate to={getInitialRoute()} /> : <Navigate to="/login" />} />

        {/* ========================================== */}
        {/* MANAGER ROUTES (AdminLayout)               */}
        {/* ========================================== */}
        {userRole === 'manager' && (
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" />} />
            <Route path="dashboard" element={<AdminDashboardScreen />} />
            {/* Add future manager routes here */}
            <Route path="*" element={<Navigate to="dashboard" />} />
          </Route>
        )}

        {/* ========================================== */}
        {/* AGENT ROUTES (Standard Layout)             */}
        {/* ========================================== */}
        {userRole === 'agent' && (
          <Route path="/" element={<Layout />}> {/* FIXED: Reverted path back to "/" */}
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