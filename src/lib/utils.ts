import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

// --- NEW AGEING LOGIC ---
export function calculateDaysOverdue(dueDate?: string): number {
  if (!dueDate) return 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day
  
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0); // Normalize to start of day
  
  const diffTime = today.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 0 ? diffDays : 0;
}

export function getAgeingBucket(daysOverdue: number): 'Current' | '0-7 days' | '8-30 days' | '30+ days' {
  if (daysOverdue <= 0) return 'Current';
  if (daysOverdue <= 7) return '0-7 days';
  if (daysOverdue <= 30) return '8-30 days';
  return '30+ days';
}