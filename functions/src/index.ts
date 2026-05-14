import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

admin.initializeApp();

export const autoRescheduleFollowups = onSchedule("every day 00:01", async (event) => {
  const db = admin.firestore();
  
  // Get today's date string in YYYY-MM-DD format
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Find all followups that are incomplete and were scheduled BEFORE today
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
    
    // Auto-rollover to today, but retain the original date for auditing
    batch.update(doc.ref, {
      originalScheduledAt: data.originalScheduledAt || data.scheduledAt, // Keep original if it exists
      scheduledAt: todayStr, // Move to today
      rescheduledCount: currentCount + 1, // Increment the audit count
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    count++;
  });

  await batch.commit();
  console.log(`Successfully rescheduled ${count} missed followups to ${todayStr}.`);
});