import { useEffect, useState } from 'react';
import { Search, Filter, Phone, MessageSquare, MapPin, ChevronRight, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { auth, db, collection, query, onSnapshot, where } from '../lib/firebase';
import { formatCurrency, cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function CustomerListScreen() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!db || !auth.currentUser) return;

    const q = query(
      collection(db, 'customers'), 
      where('assignedAgentId', '==', auth.currentUser.uid)
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers');
    });
    return unsub;
  }, []);

  const filtered = customers.filter(c => {
    const matchesSearch = c.name?.toLowerCase().includes(search.toLowerCase()) || 
                         c.mobile?.includes(search) || 
                         c.loanId?.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;

    if (filter === 'All') return true;
    if (filter === 'Due Today') {
      const today = new Date().toISOString().split('T')[0];
      return c.dueDate === today;
    }
    if (filter === 'High Amount') return (c.dueAmount || 0) > 20000;
    
    return c.status === filter;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Active Collections</h1>
        
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search by name, mobile or Loan ID"
            className="w-full bg-white border-none rounded-2xl p-4 pl-12 text-sm shadow-sm focus:ring-2 focus:ring-brand-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-none">
          {['All', 'Due Today', 'High Amount', 'Pending', 'Promise to Pay', 'Partial Payment'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
                filter === f ? "bg-brand-600 text-white shadow-md shadow-brand-100" : "bg-white text-slate-500"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filtered.map((customer) => (
          <Link 
            to={`/customers/${customer.id}`} 
            key={customer.id} 
            className="premium-card p-4 block active:scale-[0.98] transition-transform"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                  <User size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 leading-tight">{customer.name}</h4>
                  <p className="text-[10px] font-bold text-brand-600 uppercase tracking-widest">{customer.area}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="font-black text-slate-900">{formatCurrency(customer.dueAmount)}</div>
                <div className={cn(
                  "text-[10px] font-bold uppercase",
                  customer.status === 'Pending' ? "text-orange-600" : "text-emerald-600"
                )}>
                  {customer.status}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-slate-400 text-[10px] font-medium mb-4">
              <MapPin size={10} />
              <span className="truncate">{customer.address}</span>
            </div>

            <div className="flex items-center justify-between border-t border-slate-50 pt-4">
              <div className="flex space-x-3" onClick={(e) => e.stopPropagation() /* Prevent Link trigger on action click */}>
                {/* Native dialer anchor */}
                <a 
                  href={`tel:${customer.mobile}`}
                  className="w-10 h-10 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center"
                >
                  <Phone size={18} />
                </a>
                {/* Native WhatsApp anchor */}
                <a 
                  href={`https://wa.me/91${customer.mobile}`}
                  target="_blank" rel="noopener noreferrer"
                  className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"
                >
                  <MessageSquare size={18} />
                </a>
                {/* Native Google Maps anchor */}
                <a 
                  href={`https://maps.google.com/?q=${encodeURIComponent(customer.address)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center"
                >
                  <MapPin size={18} />
                </a>
              </div>
              <div className="text-slate-300">
                <ChevronRight size={20} />
              </div>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No customers found</p>
          </div>
        )}
      </div>
    </div>
  );
}