import { useEffect, useState, ReactNode } from 'react';
import { BarChart3, TrendingUp, PieChart, Download, Calendar, MessageSquare, Clock, FileSpreadsheet } from 'lucide-react';
import { auth, db, collection, query, where, onSnapshot, functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { formatCurrency, cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { format, subDays, startOfMonth, isAfter } from 'date-fns';

export default function ReportsScreen() {
  const [interactions, setInteractions] = useState<any[]>([]);
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'all'>('week');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch all interactions for this agent
    const q = query(collection(db, 'interactions'), where('agentId', '==', auth.currentUser.uid));
    
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          // Safely convert Firestore timestamp to JS Date
          dateObj: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(),
        };
      });
      
      // Sort interactions newest first
      docs.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
      
      setInteractions(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'interactions_reports');
    });

    return unsub;
  }, []);

  // 1. Filter data based on selected timeframe
  const filteredInteractions = interactions.filter(i => {
    if (timeframe === 'all') return true;
    const now = new Date();
    if (timeframe === 'week') return isAfter(i.dateObj, subDays(now, 7));
    if (timeframe === 'month') return isAfter(i.dateObj, startOfMonth(now));
    return true;
  });

  // 2. Calculate Real Stats
  const payments = filteredInteractions.filter(d => d.type === 'payment');
  const totalRecovery = payments.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
  const visitCount = filteredInteractions.length;
  const efficiency = visitCount > 0 ? Math.round((payments.length / visitCount) * 100) : 0;

  // 3. Calculate Real Chart Trend (Always shows Last 7 Days dynamically)
  const last7Days = Array.from({length: 7}).map((_, i) => subDays(new Date(), 6 - i)).reverse(); // Reverse so it goes oldest to newest (left to right)
  
  const trendData = last7Days.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    // AC1: Only calculate actual payments for the collection trend
    const dayInts = interactions.filter(i => 
      format(i.dateObj, 'yyyy-MM-dd') === dateStr && i.type === 'payment'
    );
    return dayInts.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  });
  
  const maxTrend = Math.max(...trendData, 1); // Avoid division by zero
  const trendHeights = trendData.map(val => (val / maxTrend) * 100);
  
  // AC3: Check if we actually have data to show in the chart
  const hasTrendData = trendData.some(val => val > 0);

  // 4. Print PDF functionality
  const handleDownloadPDF = () => {
    window.print();
  };

  // 5. Backend API Call for Excel/CSV Export
  const handleExportData = async () => {
    if (!auth.currentUser) return;
    setExporting(true);
    
    try {
      const exportReportFn = httpsCallable(functions, 'exportPerformanceReport');
      
      // Calls the new backend endpoint 
      const result = await exportReportFn({
        agentId: auth.currentUser.uid,
        timeframe: timeframe
      });

      const { csvBase64, fileName } = result.data as any;
      
      // Convert Base64 response to a downloadable Blob
      const byteCharacters = atob(csvBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'text/csv;charset=utf-8;' });
      
      // Trigger browser download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export performance data. Ensure you have permission.");
    } finally {
      setExporting(false);
    }
  };

  // Helper to get formatted date range for the PDF Report
  const getPeriodText = () => {
    const today = new Date();
    if (timeframe === 'week') return `${format(subDays(today, 7), 'MMM dd, yyyy')}  to  ${format(today, 'MMM dd, yyyy')}`;
    if (timeframe === 'month') return `${format(startOfMonth(today), 'MMM dd, yyyy')}  to  ${format(today, 'MMM dd, yyyy')}`;
    if (filteredInteractions.length > 0) {
      const oldest = filteredInteractions[filteredInteractions.length - 1].dateObj;
      return `${format(oldest, 'MMM dd, yyyy')}  to  ${format(today, 'MMM dd, yyyy')}`;
    }
    return 'All Time';
  };

  if (loading) return <div className="p-8 text-center text-slate-400 font-medium">Loading reports...</div>;

  return (
    <div className="bg-slate-50 min-h-screen print:bg-white print:p-0">
      
      {/* ========================================== */}
      {/* SCREEN UI: Visible on device, hidden on PDF */}
      {/* ========================================== */}
      <div className="p-6 space-y-8 pb-24 print:hidden">
        
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Performance</h1>
          
          <div className="relative">
            <select 
              value={timeframe} 
              onChange={(e) => setTimeframe(e.target.value as any)}
              className="appearance-none bg-white p-3 pr-8 rounded-2xl android-shadow border border-slate-100 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="week">Last 7 Days</option>
              <option value="month">This Month</option>
              <option value="all">All Time</option>
            </select>
            <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Main Stats Card */}
        <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <TrendingUp size={80} className="text-emerald-500" />
          </div>
          <div className="relative z-10 space-y-1">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Total Recovery</p>
            <h2 className="text-4xl font-black text-emerald-600">{formatCurrency(totalRecovery)}</h2>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <StatItem label="Visit Count" value={visitCount.toString()} icon={<BarChart3 size={20} />} />
          <StatItem label="Efficiency" value={`${efficiency}%`} icon={<PieChart size={20} />} />
        </div>

        {/* Real-time Bar Chart */}
        <div className="space-y-4">
          <h3 className="font-bold text-slate-800">Collection Trend (Last 7 Days)</h3>
          
          {!hasTrendData ? (
            /* AC3: Empty State if no data */
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm h-48 flex flex-col items-center justify-center p-6 text-center space-y-2">
              <TrendingUp size={32} className="text-slate-200" />
              <p className="text-sm font-bold text-slate-400">No collections recorded</p>
              <p className="text-xs text-slate-400">Start logging payments to see your performance trend here.</p>
            </div>
          ) : (
            <>
              <div className="p-6 h-48 flex items-end justify-between bg-white border border-slate-100 shadow-sm rounded-2xl">
                {trendHeights.map((h, i) => (
                  <div key={i} className="flex flex-col items-center justify-end w-8 h-full group relative cursor-pointer">
                    {/* AC2: Hover tooltip with Exact Date and Amount */}
                    <div className="absolute -top-12 flex flex-col items-center bg-slate-800 text-white py-1.5 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none shadow-lg">
                      <span className="text-[11px] font-black">{formatCurrency(trendData[i])}</span>
                      <span className="text-[9px] text-slate-300 font-medium">{format(last7Days[i], 'MMM dd, yyyy')}</span>
                      {/* Tooltip triangle pointer */}
                      <div className="absolute -bottom-1 w-2 h-2 bg-slate-800 rotate-45"></div>
                    </div>
                    
                    {/* The Chart Bar */}
                    <div 
                      className="w-full rounded-t-xl bg-brand-500 transition-all duration-500 group-hover:bg-brand-400" 
                      style={{ height: `${Math.max(h, 2)}%` }} // Show minimum 2% height if there's data so the bar is barely visible
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between px-2 text-[10px] font-bold text-slate-400">
                {last7Days.map((day, i) => (
                  <span key={i}>{format(day, 'EEE').toUpperCase()}</span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={handleDownloadPDF}
            className="w-full bg-slate-800 text-white p-4 rounded-2xl font-bold flex flex-col items-center justify-center space-y-1 active:bg-slate-700 transition-colors shadow-sm"
          >
            <Download size={20} />
            <span className="text-[11px] uppercase tracking-wider">Visual PDF</span>
          </button>

          <button 
            onClick={handleExportData}
            disabled={exporting}
            className="w-full bg-brand-50 text-brand-700 border border-brand-100 p-4 rounded-2xl font-bold flex flex-col items-center justify-center space-y-1 active:bg-brand-100 transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet size={20} />
            <span className="text-[11px] uppercase tracking-wider">
              {exporting ? 'Compiling...' : 'Export Data'}
            </span>
          </button>
        </div>

        {/* Visit History Log */}
        <div className="space-y-4 pt-4">
          <h3 className="font-bold text-slate-800 border-b border-slate-200 pb-2">Recent Visit History</h3>
          
          {filteredInteractions.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">No visits found in this timeframe.</div>
          ) : (
            <div className="space-y-3">
              {filteredInteractions.map((interaction) => (
                <div key={interaction.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{interaction.customerName}</h4>
                      <div className="flex items-center text-[10px] text-slate-400 space-x-1 mt-0.5">
                        <Clock size={10} />
                        <span>{format(interaction.dateObj, 'MMM dd, hh:mm a')}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={cn(
                        "px-2 py-1 rounded-md text-[10px] font-bold uppercase",
                        interaction.type === 'payment' ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                      )}>
                        {interaction.status}
                      </span>
                      {interaction.amount > 0 && (
                        <div className="font-black text-emerald-600 text-sm mt-1">
                          {formatCurrency(interaction.amount)}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {interaction.notes && (
                    <div className="mt-3 bg-slate-50 p-3 rounded-xl text-xs text-slate-600 flex items-start space-x-2 border border-slate-100">
                      <MessageSquare size={14} className="text-slate-400 mt-0.5 shrink-0" />
                      <p className="italic leading-relaxed">{interaction.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ========================================== */}
      {/* PDF UI: Hidden on device, visible on Print */}
      {/* ========================================== */}
      <div className="hidden print:block p-8 bg-white font-sans text-slate-900">
        
        {/* Report Header */}
        <div className="border-b-2 border-slate-800 pb-6 mb-8">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-black uppercase tracking-widest text-slate-900 mb-2">Field Collection Report</h1>
              <p className="text-sm font-medium text-slate-600">Generated on: {format(new Date(), 'PPpp')}</p>
              <p className="text-sm font-medium text-slate-600">Reporting Period: <span className="font-bold text-slate-900">{getPeriodText()}</span></p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Agent Detail</p>
              <p className="text-sm font-medium text-slate-800">{auth.currentUser?.email || 'Authorized Agent'}</p>
            </div>
          </div>
        </div>

        {/* Report Summary */}
        <div className="flex space-x-6 mb-8">
          <div className="flex-1 p-4 border border-slate-200 rounded-lg bg-slate-50">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">Total Amount Recovered</p>
            <p className="text-2xl font-black text-emerald-600">{formatCurrency(totalRecovery)}</p>
          </div>
          <div className="flex-1 p-4 border border-slate-200 rounded-lg bg-slate-50">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">Total Field Visits</p>
            <p className="text-2xl font-black">{visitCount}</p>
          </div>
          <div className="flex-1 p-4 border border-slate-200 rounded-lg bg-slate-50">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">Conversion Efficiency</p>
            <p className="text-2xl font-black">{efficiency}%</p>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="mb-4">
          <h2 className="text-lg font-bold border-b border-slate-300 pb-2 mb-4">Detailed Interaction Log</h2>
          {filteredInteractions.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No interactions recorded during this period.</p>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-800 bg-slate-50 text-slate-700">
                  <th className="py-3 px-2 font-bold w-1/6">Date & Time</th>
                  <th className="py-3 px-2 font-bold w-1/5">Customer Name</th>
                  <th className="py-3 px-2 font-bold w-1/6">Status</th>
                  <th className="py-3 px-2 font-bold w-1/6 text-right">Amount</th>
                  <th className="py-3 px-2 font-bold w-1/3">Remarks / Feedback</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {filteredInteractions.map((interaction, idx) => (
                  <tr key={interaction.id} className={cn("border-b border-slate-200", idx % 2 === 0 ? "bg-white" : "bg-slate-50/50")}>
                    <td className="py-3 px-2 align-top">
                      <div className="font-medium">{format(interaction.dateObj, 'MMM dd, yyyy')}</div>
                      <div className="text-xs text-slate-500">{format(interaction.dateObj, 'hh:mm a')}</div>
                    </td>
                    <td className="py-3 px-2 align-top font-bold text-slate-900">{interaction.customerName}</td>
                    <td className="py-3 px-2 align-top">
                      <span className={cn("font-bold text-xs uppercase", interaction.type === 'payment' ? "text-emerald-600" : "text-orange-600")}>
                        {interaction.status}
                      </span>
                    </td>
                    <td className="py-3 px-2 align-top font-black text-right text-slate-900">
                      {interaction.amount > 0 ? formatCurrency(interaction.amount) : '-'}
                    </td>
                    <td className="py-3 px-2 align-top text-xs italic text-slate-600">
                      {interaction.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-4 border-t border-slate-300 text-center text-xs text-slate-400">
          <p>This is a system generated report from the ProCollect Meta application.</p>
        </div>

      </div>
    </div>
  );
}

function StatItem({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="bg-white p-4 rounded-2xl space-y-3 shadow-sm border border-slate-100">
      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-brand-500">
        {icon}
      </div>
      <div>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{label}</p>
        <p className="text-lg font-black text-slate-900">{value}</p>
      </div>
    </div>
  );
}