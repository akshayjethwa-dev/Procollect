/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { auth, db, doc, onSnapshot, query, collection, where, User, getDocFromCache, getDocFromServer } from './lib/firebase';

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
import Layout from './components/Layout';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Stability check for pilot
    const checkConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test-connection', 'ping'));
      } catch (e) {
        console.warn("Connection check failed, might be offline or first load:", e);
      }
    };
    checkConnection();

    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
      setLoading(false);
    });
    
    // Show splash for at least 2 seconds
    const timer = setTimeout(() => setShowSplash(false), 2500);
    
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);

  if (showSplash) {
    return <SplashScreen />;
  }

  if (loading) {
    return null;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user ? <LoginScreen /> : <Navigate to="/dashboard" />} />
        
        <Route path="/" element={user ? <Layout /> : <Navigate to="/login" />}>
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard" element={<DashboardScreen />} />
          <Route path="customers" element={<CustomerListScreen />} />
          <Route path="customers/:id" element={<CollectionUpdateScreen />} />
          <Route path="import" element={<ImportScreen />} />
          <Route path="profile" element={<ProfileScreen />} />
          <Route path="membership" element={<MembershipScreen />} />
          <Route path="reports" element={<ReportsScreen />} />
          <Route path="followups" element={<FollowUpScreen />} />
          <Route path="notifications" element={<NotificationsScreen />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
