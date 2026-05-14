import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileUp, CheckCircle2, Loader2, AlertCircle, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { extractDataFromPDF } from '../services/geminiService';
import { db, auth, collection, doc, writeBatch, getDocs, query, where } from '../lib/firebase';
import { uploadFieldDocument } from '../lib/storage';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function ImportScreen() {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extractedData, setExtractedData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFile(acceptedFiles[0]);
    setError(null);
    setUploadProgress(0);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv']
    },
    multiple: false
  } as any);

  // Helper to map Excel/CSV rows to our Schema
  const mapRowsToCustomers = (data: any[]) => {
    return data.map(row => ({
      name: row['Name'] || row['Customer Name'] || row['name'] || 'Unknown',
      loanId: String(row['Loan ID'] || row['Loan No'] || row['loanId'] || ''),
      mobile: String(row['Phone'] || row['Mobile'] || row['phoneNumber'] || ''),
      address: row['Address'] || row['Location'] || row['location'] || '',
      dueAmount: Number(row['Due Amount'] || row['EMI'] || row['emiAmount'] || row['amount']) || 0,
      dueDate: row['Due Date'] || row['dueDate'] || new Date().toISOString().split('T')[0],
      needsReview: false // Structured data doesn't need AI review
    })).filter(item => item.loanId && item.name !== 'Unknown'); // Drop invalid rows
  };

  const handleProcessFile = async () => {
    if (!file) return;
    setProcessing(true);
    setError(null);
    
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      setError("File exceeds the 10MB limit.");
      setProcessing(false);
      return;
    }
    
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase();

      // -- USER STORY 2.3: LOCAL EXCEL/CSV PARSING --
      if (fileExt === 'csv') {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            setExtractedData(mapRowsToCustomers(results.data));
            setProcessing(false);
          }
        });
        return; // Exit early since parsing is callback based
      } 
      else if (fileExt === 'xlsx' || fileExt === 'xls') {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        setExtractedData(mapRowsToCustomers(data));
      } 
      // -- USER STORY 2.1 & 2.2: UPLOAD & AI EXTRACTION --
      else {
        // 1. Upload file securely to Firebase Storage
        const { url, path } = await uploadFieldDocument(file, (progress) => {
          setUploadProgress(Math.round(progress));
        });

        // 2. Read as Base64 for the API fallback
        const reader = new FileReader();
        const fileData = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = () => reject(new Error("Failed to read file locally."));
          reader.readAsDataURL(file);
        });

        // 3. Send to Gemini AI for Extraction (passing the secure URL as well)
        setUploadProgress(100); // Upload done, extracting now
        const data = await extractDataFromPDF(fileData, file.type, url);
        
        if (!data || !Array.isArray(data) || data.length === 0) {
          throw new Error("No data found in this document. Please ensure it's a valid list.");
        }
        
        // Attach the source document URL to the records
        setExtractedData(data.map(d => ({ ...d, documentUrl: url, documentPath: path })));
      }
    } catch (e: any) {
      setError(e.message || "An unexpected error occurred.");
      setExtractedData([]);
    } finally {
      if (file.name.split('.').pop()?.toLowerCase() !== 'csv') {
        setProcessing(false);
      }
    }
  };

  const handleImport = async () => {
    if (!auth.currentUser) return setError("Please log in again.");

    setLoading(true);
    setError(null);
    
    try {
      // -- DUPLICATION PREVENTION --
      // Fetch existing Loan IDs for this agent to prevent double-entry
      const existingQuery = query(
        collection(db, 'customers'), 
        where('assignedAgentId', '==', auth.currentUser.uid)
      );
      const existingDocs = await getDocs(existingQuery);
      const existingLoanIds = new Set(existingDocs.docs.map(d => d.data().loanId));

      const finalDataToImport = extractedData.filter(item => !existingLoanIds.has(item.loanId));

      if (finalDataToImport.length === 0) {
        throw new Error("All items in this list are already in your database (Duplicate Loan IDs).");
      }

      // Batch Writing Logic
      const CHUNK_SIZE = 450;
      for (let i = 0; i < finalDataToImport.length; i += CHUNK_SIZE) {
        const batch = writeBatch(db);
        const currentChunk = finalDataToImport.slice(i, i + CHUNK_SIZE);
        
        currentChunk.forEach(item => {
          const ref = doc(collection(db, 'customers'));
          batch.set(ref, {
            ...item,
            id: ref.id,
            status: 'Pending',
            assignedAgentId: auth.currentUser?.uid, 
            createdAt: new Date().toISOString(),
            receivedAmount: 0
          });
        });
        
        await batch.commit();
      }

      navigate('/customers');
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, 'customers');
      setError(e.message || "An error occurred while saving to the database.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Import Collections</h1>
        <p className="text-sm text-slate-500 font-medium">Upload Documents, Images, or Excel sheets</p>
      </div>

      {!extractedData.length && !processing ? (
        <div className="space-y-6">
          <div 
            {...getRootProps()} 
            className={`premium-card p-12 border-dashed border-2 flex flex-col items-center justify-center text-center space-y-4 transition-colors cursor-pointer ${isDragActive ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}
          >
            <input {...getInputProps()} />
            <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center text-brand-600">
              {file?.type.startsWith('image/') ? <ImageIcon size={32} /> : <FileUp size={32} />}
            </div>
            <div>
              <p className="font-bold text-slate-900">{file ? file.name : "Select or Drop File"}</p>
              <p className="text-xs text-slate-500 font-medium mt-1">Image, PDF, XLSX or CSV up to 10MB</p>
            </div>
          </div>

          <button 
            onClick={handleProcessFile}
            disabled={!file || processing}
            className="w-full bg-brand-600 text-white p-5 rounded-2xl font-bold flex items-center justify-center space-x-3 disabled:opacity-50 shadow-lg shadow-brand-100"
          >
            <span>Process Document</span>
          </button>
        </div>
      ) : (
        extractedData.length > 0 && !processing ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900">Extracted ({extractedData.length})</h2>
              <button onClick={() => setExtractedData([])} className="text-brand-600 font-bold text-sm">Clear</button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 pb-10">
              {extractedData.map((item, i) => (
                <div key={i} className={`premium-card p-4 flex justify-between items-start border-l-4 ${item.needsReview ? 'border-amber-400 bg-amber-50/30' : 'border-brand-500'}`}>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-bold text-slate-900">{item.name}</h4>
                      {item.needsReview && (
                        <span className="flex items-center text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                          <AlertTriangle size={10} className="mr-1" /> Review
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-medium">{item.loanId} • {item.mobile}</p>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] truncate">{item.address}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">{formatCurrency(item.dueAmount)}</div>
                    <div className="text-[10px] font-bold text-orange-600 uppercase">Due: {item.dueDate}</div>
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={handleImport}
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
             <p className="font-bold text-slate-700">
               {uploadProgress > 0 && uploadProgress < 100 
                 ? `Uploading securely... ${uploadProgress}%` 
                 : "Analyzing document with ProCollect AI..."}
             </p>
             {uploadProgress > 0 && uploadProgress < 100 && (
               <div className="w-64 h-2 bg-slate-100 rounded-full overflow-hidden">
                 <div className="h-full bg-brand-600 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
               </div>
             )}
          </div>
        )
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center space-x-3 border border-red-100">
          <AlertCircle size={20} className="flex-shrink-0" />
          <p className="text-xs font-bold">{error}</p>
        </div>
      )}
    </div>
  );
}