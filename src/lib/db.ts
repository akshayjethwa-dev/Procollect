import Dexie, { Table } from 'dexie';

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  address: string;
  totalDueAmount: number; // <-- AGGREGATED: Sum of all active loans
  totalReceivedAmount: number; // <-- AGGREGATED
  status: string; // Master status
  assignedAgentId: string;
  lastVisitDate?: string;
  nextFollowUpDate?: string;
  createdAt: string;
  updatedAt?: string;
  // Legacy fields kept for backward compatibility during transition
  dueAmount?: number; 
  loanId?: string;
}

// --- NEW LOAN INTERFACE ---
export interface Loan {
  id: string;
  customerId: string; // Reference to parent
  loanId: string;
  dueAmount: number;
  receivedAmount: number;
  dueDate: string;
  emiAmount?: number;
  status: string;
  assignedAgentId: string;
  batchId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface BatchImport {
  id: string;
  fileName: string;
  filePath: string | null;
  createdAt: string;
  createdBy: string;
  totalRows: number;
  importedRows: number;
  sourceType: string;
}

export interface Visit {
  id: string;
  customerId: string;
  agentId: string;
  date: string;
  status: string;
  notes: string;
  location?: { lat: number; lng: number };
  photoUrl?: string;
}

export interface FollowUp {
  id: string;
  customerId: string;
  agentId: string;
  scheduledAt: string;
  notes: string;
  status: 'pending' | 'completed' | 'missed';
  // --- NEW FIELDS FOR RECURRING / RESCHEDULING ---
  originalScheduledAt?: string;
  rescheduledCount?: number;
}

export interface Notification {
  id: string;
  agentId: string;
  title: string;
  message: string;
  sentAt: string;
  read: boolean;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  createdAt: string;
  photoURL?: string;
}

export class ProCollectDatabase extends Dexie {
  customers!: Table<Customer>;
  loans!: Table<Loan>; // Dexie tracking for offline loans
  visits!: Table<Visit>;
  followups!: Table<FollowUp>;
  notifications!: Table<Notification>;
  users!: Table<UserProfile>;

  constructor() {
    super('ProCollectDB');
    this.version(2).stores({
      customers: 'id, assignedAgentId, status, mobile',
      loans: 'id, customerId, loanId, assignedAgentId',
      visits: 'id, customerId, agentId, date',
      followups: 'id, customerId, agentId, scheduledAt, status',
      notifications: 'id, agentId, sentAt, read',
      users: 'uid, email'
    });
  }
}

export const db = new ProCollectDatabase();