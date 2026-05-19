// src/lib/db.ts
import Dexie, { Table } from 'dexie';

// NEW: Agency Table for Multi-tenancy Management
export interface Agency {
  id: string;
  name: string;
  adminId: string; // UID of the Manager/Admin who created it
  contactEmail?: string;
  contactPhone?: string;
  status: 'active' | 'suspended' | 'inactive';
  subscriptionPlan: 'trial' | 'pro' | 'enterprise';
  createdAt: string;
  updatedAt?: string;
}

export interface Customer {
  id: string;
  agencyId: string; 
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
  agencyId: string; 
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
  agencyId: string; 
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
  agencyId: string; 
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
  agencyId: string; 
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
  agencyId: string; 
  agentId: string;
  title: string;
  message: string;
  sentAt: string;
  read: boolean;
}

export interface UserProfile {
  uid: string;
  agencyId: string; 
  name: string;
  email: string;
  createdAt: string;
  photoURL?: string;
  // UPDATED: Added 'independent_agent' role
  role?: 'admin' | 'agency_manager' | 'agent' | 'independent_agent'; 
}

export interface CashDeposit {
  id: string;
  agentId: string;
  agentName: string; 
  agencyId: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  notes: string;
  rejectionReason?: string;
  createdAt: string;
  processedAt?: string;
  processedBy?: string; 
}

export class ProCollectDatabase extends Dexie {
  agencies!: Table<Agency>; 
  customers!: Table<Customer>;
  loans!: Table<Loan>; 
  visits!: Table<Visit>;
  followups!: Table<FollowUp>;
  notifications!: Table<Notification>;
  users!: Table<UserProfile>;
  cashDeposits!: Table<CashDeposit>; 

  constructor() {
    super('ProCollectDB');
    this.version(5).stores({
      agencies: 'id, adminId, status', 
      customers: 'id, agencyId, assignedAgentId, status, mobile',
      loans: 'id, agencyId, customerId, loanId, assignedAgentId',
      visits: 'id, agencyId, customerId, agentId, date',
      followups: 'id, agencyId, customerId, agentId, scheduledAt, status',
      notifications: 'id, agencyId, agentId, sentAt, read',
      users: 'uid, agencyId, email',
      cashDeposits: 'id, agencyId, agentId, status, createdAt'
    });
  }
}

export const db = new ProCollectDatabase();