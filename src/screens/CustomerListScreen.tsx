import { useEffect, useState } from 'react';
import { Search, Filter, Phone, MessageSquare, MapPin, ChevronRight, User, Layers, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth, db, collection, query, onSnapshot, where } from '../lib/firebase';
import { formatCurrency, cn, calculateDaysOverdue, getAgeingBucket } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface BatchImport {
  id: string;
  fileName: string;
  createdAt: string;
  importedRows: number;
  [key: string]: any;
}

export default function CustomerListScreen() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [batches, setBatches] = useState<BatchImport[]>([]); 
  
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('all');
  
  const navigate = useNavigate();

  useEffect(() => {
    if (!db || !auth.currentUser) return;

    const qCustomers = query(
      collection(db, 'customers'), 
      where('assignedAgentId', '==', auth.currentUser.uid)
    );
    
    const unsubCustomers = onSnapshot(qCustomers, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers');
    });

    const qBatches = query(
      collection(db, 'batches'),
      where('createdBy', '==', auth.currentUser.uid)
    );

    const unsubBatches = onSnapshot(qBatches, (snapshot) => {
      const fetchedBatches = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...(doc.data() as any)
      } as BatchImport));
      
      fetchedBatches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBatches(fetchedBatches);
    }, (error) => {
      console.error("Failed to fetch batches:", error);
    });

    return () => {
      unsubCustomers();
      unsubBatches();
    };
  }, []);

  const filtered = customers.filter(c => {
    if (selectedBatch !== 'all' && c.batchId !== selectedBatch) return false;

    const matchesSearch = c.name?.toLowerCase().includes(search.toLowerCase()) || 
                         c.mobile?.includes(search) || 
                         c.loanId?.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;

    const dueAmt = c.totalDueAmount !== undefined ? c.totalDueAmount : (c.dueAmount || 0);
    const daysOverdue = calculateDaysOverdue(c.dueDate);

    // Filter Logic
    if (filter === 'All') return true;
    if (filter === 'Due Today') {
      const today = new Date().toISOString().split('T')[0];
      return c.dueDate === today;
    }
    if (filter === 'High Amount') return dueAmt > 20000;
    
    // Ageing bucket filters
    if (filter === '0-7 days Overdue') return daysOverdue >= 1 && daysOverdue <= 7 && c.status !== 'Full Payment';
    if (filter === '8-30 days Overdue') return daysOverdue >= 8 && daysOverdue <= 30 && c.status !== 'Full Payment';
    if (filter === '30+ days Overdue') return daysOverdue > 30 && c.status !== 'Full Payment';
    
    return c.status === filter;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Active Collections</h1>
        
        {/* Search Bar */}
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

        {/* Batch Filter Dropdown */}
        {batches.length > 0 && (
          <div className="relative">
            <Layers className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-500" size={18} />
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="w-full bg-white border-none rounded-2xl p-4 pl-12 pr-10 text-sm shadow-sm focus:ring-2 focus:ring-brand-500 appearance-none font-medium text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">All Imported Lists</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.fileName} ({new Date(b.createdAt).toLocaleDateString()}) • {b.importedRows} rows
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <ChevronRight size={16} className="rotate-90" />
            </div>
          </div>
        )}

        {/* Quick Filter Pills */}
        <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-none">
          {['All', 'Due Today', '0-7 days Overdue', '8-30 days Overdue', '30+ days Overdue', 'High Amount', 'Pending', 'Promise to Pay'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border",
                filter === f 
                  ? "bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-100" 
                  : f.includes('Overdue') 
                    ? "bg-white text-red-600 border-red-100 hover:bg-red-50" 
                    : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filtered.map((customer) => {
          const displayDue = customer.totalDueAmount !== undefined ? customer.totalDueAmount : (customer.dueAmount || 0);
          const daysOverdue = calculateDaysOverdue(customer.dueDate);
          const isOverdue = daysOverdue > 0 && customer.status !== 'Full Payment';

          return (
            <div 
              key={customer.id} 
              onClick={() => navigate(`/customers/${customer.id}`)}
              className={cn(
                "premium-card p-4 block cursor-pointer active:scale-[0.98] transition-transform",
                isOverdue && "border-l-4 border-l-red-500"
              )}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                    <User size={24} />
                  </div>
                  <div>
                    <div className="flex items-center">
                      <h4 className="font-bold text-slate-900 leading-tight">{customer.name}</h4>
                      {isOverdue && (
                        <span className="ml-2 flex items-center bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">
                          <AlertCircle size={10} className="mr-1" />
                          {getAgeingBucket(daysOverdue)}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-brand-600 uppercase tracking-widest mt-0.5">
                      {customer.mobile}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-slate-900">{formatCurrency(displayDue)}</div>
                  <div className={cn(
                    "text-[10px] font-bold uppercase",
                    customer.status === 'Pending' ? "text-orange-600" : "text-emerald-600"
                  )}>
                    {customer.status}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 text-slate-400 text-[10px] font-medium mb-4">
                <MapPin size={10} className="shrink-0" />
                <span className="truncate">{customer.address}</span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                <div className="flex space-x-3" onClick={(e) => e.stopPropagation()}>
                  <a 
                    href={`tel:${customer.mobile}`}
                    className="w-10 h-10 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center hover:bg-brand-100 transition-colors"
                  >
                    <Phone size={18} />
                  </a>
                  <a 
                    href={`https://wa.me/91${customer.mobile}`}
                    target="_blank" rel="noopener noreferrer"
                    className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center hover:bg-emerald-100 transition-colors"
                  >
                    <MessageSquare size={18} />
                  </a>
                  <a 
                    href={`http://googleusercontent.com/maps.google.com/?q=${encodeURIComponent(customer.address)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center hover:bg-orange-100 transition-colors"
                  >
                    <MapPin size={18} />
                  </a>
                </div>
                <div className="text-slate-300">
                  <ChevronRight size={20} />
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No customers found</p>
            {selectedBatch !== 'all' && (
              <p className="text-slate-400 text-[10px] mt-2">Try selecting a different batch or clearing the search</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}