/* eslint-disable */
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore"; // <-- Added Import
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

// --- NEW: Sync Firestore User Role to Auth Custom Claims ---
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