import Dexie, { Table } from 'dexie';

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  address: string;
  dueAmount: number;
  receivedAmount: number;
  status: 'Pending' | 'Full Payment' | 'Partial Payment' | 'Promise to Pay' | 'Not Reachable' | 'Wrong Address' | 'Refused' | 'Dispute' | 'Customer Shifted' | 'Deceased';
  assignedAgentId: string;
  bankName?: string;
  pincode?: string;
  emiAmount?: number;
  lastVisitDate?: string;
  nextFollowUpDate?: string;
  createdAt: string;
  updatedAt?: string;
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
  visits!: Table<Visit>;
  followups!: Table<FollowUp>;
  notifications!: Table<Notification>;
  users!: Table<UserProfile>;

  constructor() {
    super('ProCollectDB');
    this.version(1).stores({
      customers: 'id, assignedAgentId, status, mobile',
      visits: 'id, customerId, agentId, date',
      followups: 'id, customerId, agentId, scheduledAt, status',
      notifications: 'id, agentId, sentAt, read',
      users: 'uid, email'
    });
  }
}

export const db = new ProCollectDatabase();
