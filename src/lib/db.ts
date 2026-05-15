// src/lib/db.ts
import Dexie, { Table } from 'dexie';

export interface Customer {
  id: string;
  agencyId: string; // <-- NEW: Multi-tenancy isolation
  name: string;
  mobile: string;
  address: string;
  totalDueAmount: number;
  totalReceivedAmount: number;
  status: string; 
  assignedAgentId: string;
  lastVisitDate?: string;
  nextFollowUpDate?: string;
  createdAt: string;
  updatedAt?: string;
  dueAmount?: number; 
  loanId?: string;
}

export interface Loan {
  id: string;
  agencyId: string; // <-- NEW
  customerId: string; 
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
  agencyId: string; // <-- NEW
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
  agencyId: string; // <-- NEW
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
  agencyId: string; // <-- NEW
  customerId: string;
  agentId: string;
  scheduledAt: string;
  notes: string;
  status: 'pending' | 'completed' | 'missed';
  originalScheduledAt?: string;
  rescheduledCount?: number;
}

export interface Notification {
  id: string;
  agencyId: string; // <-- NEW
  agentId: string;
  title: string;
  message: string;
  sentAt: string;
  read: boolean;
}

export interface UserProfile {
  uid: string;
  agencyId: string; // <-- NEW: Ties an agent/admin to a workspace
  name: string;
  email: string;
  createdAt: string;
  photoURL?: string;
  role?: 'admin' | 'agent'; // Useful for future role-based checks
}

export class ProCollectDatabase extends Dexie {
  customers!: Table<Customer>;
  loans!: Table<Loan>; 
  visits!: Table<Visit>;
  followups!: Table<FollowUp>;
  notifications!: Table<Notification>;
  users!: Table<UserProfile>;

  constructor() {
    super('ProCollectDB');
    // Bumped version to 3 and added agencyId to indices for fast querying
    this.version(3).stores({
      customers: 'id, agencyId, assignedAgentId, status, mobile',
      loans: 'id, agencyId, customerId, loanId, assignedAgentId',
      visits: 'id, agencyId, customerId, agentId, date',
      followups: 'id, agencyId, customerId, agentId, scheduledAt, status',
      notifications: 'id, agencyId, agentId, sentAt, read',
      users: 'uid, agencyId, email'
    });
  }
}

export const db = new ProCollectDatabase();