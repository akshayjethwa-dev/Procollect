import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileUp, FileText, CheckCircle2, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { extractDataFromPDF } from '../services/geminiService';
import { db, auth, collection, doc, writeBatch } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function ImportScreen() {
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFile(acceptedFiles[0]);
    setError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv']
    },
    multiple: false
  } as any);

  const handleProcessFile = async () => {
    if (!file) return;
    setExtracting(true);
    setError(null);
    
    try {
      const reader = new FileReader();
      
      const fileData = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const data = await extractDataFromPDF(fileData, file.type);
      
      if (!data || data.length === 0) {
        throw new Error("No data could be extracted from this file. Please ensure it's a clear document.");
      }
      
      setExtractedData(data);
    } catch (e: any) {
      console.error("Extraction failed:", e);
      setError(e.message || "Failed to extract data. Please try again.");
    } finally {
      setExtracting(false);
    }
  };

  const handleImport = async (dataToImport = extractedData) => {
    if (!auth.currentUser) {
      setError("Please log in again to continue.");
      return;
    }

    if (dataToImport.length === 0) {
      setError("No data to import.");
      return;
    }

    setLoading(true);
    console.log(`Starting import of ${dataToImport.length} items for agent ${auth.currentUser.uid}`);
    try {
      const batch = writeBatch(db);
      dataToImport.forEach(item => {
        const ref = doc(collection(db, 'customers'));
        const customerData = {
          ...item,
          id: ref.id,
          status: 'Pending',
          assignedAgentId: auth.currentUser?.uid,
          createdAt: new Date().toISOString(),
          receivedAmount: 0 // Initialize to 0
        };
        batch.set(ref, customerData);
      });
      await batch.commit();
      console.log("Batch commit successful");
      navigate('/customers');
    } catch (e: any) {
      console.error("Batch commit failed", e);
      handleFirestoreError(e, OperationType.WRITE, 'customers');
    } finally {
      setLoading(false);
    }
  };

  const loadSampleData = () => {
    const sampleData = [
      { name: "Rajesh Patel", mobile: "9876543210", address: "Nikol Road, Ahmedabad", dueAmount: 18500, dueDate: "2026-05-15", loanId: "LN1001", area: "Nikol" },
      { name: "Amit Shah", mobile: "9898989898", address: "Maninagar, Ahmedabad", dueAmount: 9200, dueDate: "2026-05-14", loanId: "LN1002", area: "Maninagar" },
      { name: "Pooja Mehta", mobile: "9811112233", address: "Satellite, Ahmedabad", dueAmount: 25000, dueDate: "2026-05-16", loanId: "LN1003", area: "Satellite" },
      { name: "Kiran Desai", mobile: "9822233344", address: "Naranpura, Ahmedabad", dueAmount: 6700, dueDate: "2026-05-14", loanId: "LN1004", area: "Naranpura" },
      { name: "Sanjay Kumar", mobile: "9833344455", address: "Bopal, Ahmedabad", dueAmount: 31000, dueDate: "2026-05-17", loanId: "LN1005", area: "Bopal" },
      { name: "Neha Joshi", mobile: "9844455566", address: "Gota, Ahmedabad", dueAmount: 14500, dueDate: "2026-05-15", loanId: "LN1006", area: "Gota" },
      { name: "Rakesh Singh", mobile: "9855566677", address: "Chandkheda, Ahmedabad", dueAmount: 5600, dueDate: "2026-05-13", loanId: "LN1007", area: "Chandkheda" },
      { name: "Vikas Yadav", mobile: "9866677788", address: "CG Road, Ahmedabad", dueAmount: 42000, dueDate: "2026-05-18", loanId: "LN1008", area: "CG Road" },
      { name: "Anjali Verma", mobile: "9877788899", address: "Thaltej, Ahmedabad", dueAmount: 7800, dueDate: "2026-05-14", loanId: "LN1009", area: "Thaltej" },
      { name: "Deepak Jain", mobile: "9888899900", address: "Iskon, Ahmedabad", dueAmount: 12000, dueDate: "2026-05-15", loanId: "LN1010", area: "Iskon" }
    ];
    handleImport(sampleData);
  };

  return (
    <div className="p-6 space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Import Collections</h1>
        <p className="text-sm text-slate-500 font-medium">Upload PDF, Excel or CSV lists</p>
      </div>

      {!extractedData.length && !extracting ? (
        <div className="space-y-6">
          <div 
            {...getRootProps()} 
            className={`premium-card p-12 border-dashed border-2 flex flex-col items-center justify-center text-center space-y-4 transition-colors cursor-pointer ${isDragActive ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}
          >
            <input {...getInputProps()} />
            <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center text-brand-600">
              <FileUp size={32} />
            </div>
            <div>
              <p className="font-bold text-slate-900">{file ? file.name : "Select or Drop File"}</p>
              <p className="text-xs text-slate-500 font-medium mt-1">PDF, XLSX or CSV up to 10MB</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button 
              onClick={handleProcessFile}
              disabled={!file || extracting}
              className="w-full bg-brand-600 text-white p-5 rounded-2xl font-bold flex items-center justify-center space-x-3 disabled:opacity-50 shadow-lg shadow-brand-100"
            >
              {extracting ? (
                <>
                  <Loader2 size={24} className="animate-spin" />
                  <span>Auto-Extracting AI...</span>
                </>
              ) : (
                <span>Process with ProCollect AI</span>
              )}
            </button>
            
            <button
              onClick={loadSampleData}
              disabled={loading}
              className="w-full bg-slate-100 text-slate-600 p-5 rounded-2xl font-bold flex items-center justify-center gap-2 border border-slate-200"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
              Import Provided PDF Data
            </button>
          </div>
        </div>
      ) : (
        extractedData.length > 0 && !extracting ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900">Extracted ({extractedData.length})</h2>
              <button onClick={() => setExtractedData([])} className="text-brand-600 font-bold text-sm">Clear</button>
            </div>

            <div className="space-y-3">
              {extractedData.map((item, i) => (
                <div key={i} className="premium-card p-4 flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-900">{item.name}</h4>
                    <p className="text-xs text-slate-500 font-medium">{item.loanId} • {item.mobile}</p>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-[150px] truncate">{item.address}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">{formatCurrency(item.dueAmount)}</div>
                    <div className="text-[10px] font-bold text-orange-600 uppercase">Due: {item.dueDate}</div>
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={() => handleImport()}
              disabled={loading}
              className="w-full bg-brand-600 text-white p-5 rounded-2xl font-bold shadow-lg shadow-brand-100 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              Import to Database
            </button>
          </motion.div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
             <Loader2 size={48} className="text-brand-600 animate-spin" />
             <p className="font-bold text-slate-500">Processing...</p>
          </div>
        )
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center space-x-3 border border-red-100">
          <AlertCircle size={20} />
          <p className="text-xs font-bold">{error}</p>
        </div>
      )}

      <div className="premium-card p-6 bg-slate-950 text-white space-y-4">
        <h3 className="font-bold flex items-center space-x-2">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span>Smart Features</span>
        </h3>
        <ul className="space-y-2 text-slate-400">
          <li className="text-[10px] uppercase font-bold tracking-widest">• Auto Address Parsing</li>
          <li className="text-[10px] uppercase font-bold tracking-widest">• Duplicity Check</li>
          <li className="text-[10px] uppercase font-bold tracking-widest">• Priority Multiplier</li>
        </ul>
      </div>
    </div>
  );
}
