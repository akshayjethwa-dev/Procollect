/* eslint-disable */
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

admin.initializeApp();

export const autoRescheduleFollowups = onSchedule("every day 00:01", async () => {
  const db = admin.firestore();
  
  const todayStr = new Date().toISOString().split('T')[0];
  
  const snapshot = await db.collection('followups')
    .where('completed', '==', false)
    .where('scheduledAt', '<', todayStr)
    .get();

  if (snapshot.empty) {
    console.log("No overdue followups to reschedule.");
    return;
  }

  const batch = db.batch();
  let count = 0;

  snapshot.forEach(doc => {
    const data = doc.data();
    const currentCount = data.rescheduledCount || 0;
    
    batch.update(doc.ref, {
      originalScheduledAt: data.originalScheduledAt || data.scheduledAt, 
      scheduledAt: todayStr, 
      rescheduledCount: currentCount + 1, 
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    count++;
  });

  await batch.commit();
  console.log(`Successfully rescheduled ${count} missed followups to ${todayStr}.`);
});

// --- Export Performance Report Function ---
export const exportPerformanceReport = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be logged in to export data.');
  }

  const agentId = request.data.agentId;
  const timeframe = request.data.timeframe || 'week';

  if (request.auth.uid !== agentId && !request.auth.token?.admin) {
    throw new HttpsError('permission-denied', 'You are not authorized to export this agent data.');
  }

  // 1. Fetch ALL interactions for this agent
  const query = admin.firestore().collection('interactions').where('agentId', '==', agentId);
  const snapshot = await query.get();
  
  let interactions = snapshot.docs.map(doc => doc.data());

  // 2. Filter the dates in-memory
  const now = new Date();
  let startDate: Date | null = null;
  
  if (timeframe === 'week') {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 7);
  } else if (timeframe === 'month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  if (startDate) {
    const startMillis = startDate.getTime();
    interactions = interactions.filter(i => {
      // Safely check if timestamp exists
      const docMillis = i.timestamp?.toMillis ? i.timestamp.toMillis() : 0;
      return docMillis >= startMillis;
    });
  }

  // Aggregate stats
  let totalRecovery = 0;
  let payments = 0;
  const visitCount = interactions.length;

  const csvRows = ['Date,Customer Name,Status,Type,Amount,Notes'];

  // 3. Sort newest first safely, and format to CSV
  interactions.sort((a, b) => {
    const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
    const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
    return timeB - timeA;
  }).forEach(i => {
    if (i.type === 'payment') {
      totalRecovery += Number(i.amount) || 0;
      payments++;
    }
    
    // Safely format date
    let dateStr = "N/A";
    if (i.timestamp?.toDate) {
      dateStr = i.timestamp.toDate().toLocaleString().replace(/,/g, '');
    }
    
    // Safely format strings to prevent CSV breakage
    const notes = i.notes ? `"${i.notes.replace(/"/g, '""')}"` : ''; 
    const amount = i.amount || 0;
    const status = i.status || '';
    const type = i.type || '';
    const customerName = i.customerName ? `"${i.customerName}"` : '';

    csvRows.push(`${dateStr},${customerName},${status},${type},${amount},${notes}`);
  });

  const efficiency = visitCount > 0 ? Math.round((payments / visitCount) * 100) : 0;

  const summary = [
    `ProCollect Performance Report`,
    `Agent ID:,${agentId}`,
    `Reporting Period:,${timeframe.toUpperCase()}`,
    `Total Recovery:,${totalRecovery}`,
    `Visit Count:,${visitCount}`,
    `Efficiency:,${efficiency}%`,
    '', 
    ...csvRows
  ].join('\n');

  return {
    csvBase64: Buffer.from(summary).toString('base64'),
    fileName: `Performance_Report_${timeframe}.csv`
  };
});

// --- Sync Firestore User Role to Auth Custom Claims ---
export const syncUserRoleToCustomClaims = onDocumentWritten("users/{userId}", async (event) => {
  const userId = event.params.userId;
  
  // Get the data after the change
  const afterData = event.data?.after.data();

  // If the document was deleted, we don't need to do anything
  if (!afterData) {
    return;
  }

  const currentRole = afterData.role;
  const beforeRole = event.data?.before?.data()?.role;

  // Only proceed if the role exists and has actually changed to save execution time
  if (currentRole && currentRole !== beforeRole) {
    try {
      // 1. Fetch existing claims so we don't overwrite other claims (like agencyId or isSubscribed)
      const userRecord = await admin.auth().getUser(userId);
      const currentClaims = userRecord.customClaims || {};

      // 2. Set the new role claim along with existing claims
      await admin.auth().setCustomUserClaims(userId, {
        ...currentClaims,
        role: currentRole
      });

      console.log(`Successfully updated custom claims for user ${userId} to role: ${currentRole}`);
    } catch (error) {
      console.error(`Failed to set custom claims for user ${userId}:`, error);
    }
  }
});


// ==========================================
// NEW: AGENT MANAGEMENT FUNCTIONS
// ==========================================

export const createAgentAccount = onCall(async (request) => {
  // 1. Verify caller is authenticated
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be logged in to provision an agent.');
  }

  // 2. Verify caller has Manager permissions
  const callerId = request.auth.uid;
  const callerRecord = await admin.auth().getUser(callerId);
  if (callerRecord.customClaims?.role !== 'manager') {
    throw new HttpsError('permission-denied', 'Only managers can provision new agents.');
  }

  const { name, phone, password } = request.data;
  if (!name || !phone || !password) {
    throw new HttpsError('invalid-argument', 'Name, phone, and password are required.');
  }

  // 3. Generate Agent ID and dummy login email
  const generatedId = `AGT-${Math.floor(10000 + Math.random() * 90000)}`;
  const loginEmail = `${generatedId.toLowerCase()}@procollect.local`; 
  
  // Fallback to manager's UID if agencyId isn't explicitly set yet
  const managerAgencyId = callerRecord.customClaims?.agencyId || callerId; 

  try {
    // 4. Create Auth User
    const userRecord = await admin.auth().createUser({
      email: loginEmail,
      password: password,
      displayName: name,
    });

    // 5. Set Custom Claims instantly
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: 'agent',
      agencyId: managerAgencyId
    });

    // 6. Create Firestore Profile
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      name,
      phone,
      agentId: generatedId,
      email: loginEmail, // Store login email so it can be displayed in UI
      role: 'agent',
      agencyId: managerAgencyId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      active: true
    });

    return { 
      uid: userRecord.uid, 
      agentId: generatedId,
      email: loginEmail,
      message: "Agent created successfully." 
    };
  } catch (error: any) {
    console.error("Error creating agent:", error);
    throw new HttpsError('internal', error.message || 'Failed to create agent');
  }
});

export const resetAgentPassword = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Not logged in');
  }

  const callerRecord = await admin.auth().getUser(request.auth.uid);
  if (callerRecord.customClaims?.role !== 'manager') {
    throw new HttpsError('permission-denied', 'Only managers can reset passwords.');
  }
  
  const { uid, newPassword } = request.data;
  if (!uid || !newPassword) {
    throw new HttpsError('invalid-argument', 'Missing user ID or new password');
  }

  try {
    // Security check: Ensure agent belongs to this manager's agency
    const agentRecord = await admin.auth().getUser(uid);
    const managerAgencyId = callerRecord.customClaims?.agencyId || request.auth.uid;
    
    if (agentRecord.customClaims?.agencyId !== managerAgencyId) {
      throw new HttpsError('permission-denied', 'Cannot modify an agent outside your agency.');
    }

    await admin.auth().updateUser(uid, { password: newPassword });
    return { message: "Password updated successfully" };
  } catch (error: any) {
    console.error("Error resetting password:", error);
    throw new HttpsError('internal', 'Failed to reset password');
  }
});