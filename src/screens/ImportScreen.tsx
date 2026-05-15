import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileUp, Loader2, AlertCircle, Image as ImageIcon, AlertTriangle, Edit2, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { extractDataFromPDF } from '../services/geminiService';
import { db, auth, collection, doc, writeBatch, getDocs, query, where, setDoc } from '../lib/firebase';
import { getUserAgencyId } from '../lib/firebase';
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
  const [extractionStatus, setExtractionStatus] = useState("Processing...");
  const navigate = useNavigate();

  const [existingLoansInfo, setExistingLoansInfo] = useState<Map<string, { batchId: string }>>(new Map());
  
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>(null);

  useEffect(() => {
    const fetchExistingData = async () => {
      if (auth.currentUser) {
        try {
          const infoMap = new Map();

          // Fetch all flat customers to check for existing Loan IDs
          const existingCustQuery = query(collection(db, 'customers'), where('assignedAgentId', '==', auth.currentUser.uid));
          const existingCustDocs = await getDocs(existingCustQuery);
          
          existingCustDocs.docs.forEach(d => {
            const data = d.data() as any; 
            if (data.loanId) {
              infoMap.set(String(data.loanId), { batchId: data.batchId || 'Legacy' });
            }
          });

          setExistingLoansInfo(infoMap);
        } catch (error) {
          console.error("Failed to fetch existing loans", error);
        }
      }
    };
    fetchExistingData();
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFile(acceptedFiles[0]);
    setError(null);
    setUploadProgress(0);
    setExtractionStatus("Processing...");
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

  const mapRowsToCustomers = (data: any[]) => {
    return data.map(row => ({
      name: row['Name'] || row['Customer Name'] || row['name'] || 'Unknown',
      loanId: String(row['Loan ID'] || row['Loan No'] || row['loanId'] || ''),
      mobile: String(row['Phone'] || row['Mobile'] || row['phoneNumber'] || ''),
      address: row['Address'] || row['Location'] || row['location'] || '',
      dueAmount: Number(row['Due Amount'] || row['EMI'] || row['emiAmount'] || row['amount']) || 0,
      dueDate: row['Due Date'] || row['dueDate'] || new Date().toISOString().split('T')[0],
      needsReview: false,
    })).filter(item => item.loanId && item.name !== 'Unknown');
  };

  const handleProcessFile = async () => {
    if (!file) return;
    setProcessing(true);
    setError(null);
    setExtractedData([]);

    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      setError("File exceeds the 10MB limit.");
      setProcessing(false);
      return;
    }

    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase();

      if (fileExt === 'csv') {
        setExtractionStatus("Parsing CSV file...");
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            setExtractedData(mapRowsToCustomers(results.data));
            setProcessing(false);
          },
          error: () => {
            setError("Failed to parse CSV file. Please check the format.");
            setProcessing(false);
          }
        });
        return;
      } else if (fileExt === 'xlsx' || fileExt === 'xls') {
        setExtractionStatus("Parsing Excel file...");
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        setExtractedData(mapRowsToCustomers(data));
      } else {
        setExtractionStatus("Uploading document securely...");
        const { url, path } = await uploadFieldDocument(file, (progress) => {
          setUploadProgress(Math.round(progress));
        });

        setExtractionStatus("Preparing document for AI analysis...");
        const reader = new FileReader();
        const fileData = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = () => reject(new Error("Failed to read file locally."));
          reader.readAsDataURL(file);
        });

        setUploadProgress(100);
        const data = await extractDataFromPDF(
          fileData,
          file.type,
          url,
          (msg) => setExtractionStatus(msg)
        );

        if (!data || !Array.isArray(data) || data.length === 0) {
          throw new Error("No data found in this document. Please ensure it contains valid loan records.");
        }

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

  const handleEditClick = (index: number, item: any) => {
    setEditingIndex(index);
    setEditForm({ ...item });
  };

  const handleSaveEdit = (index: number) => {
    const updatedData = [...extractedData];
    updatedData[index] = editForm;
    setExtractedData(updatedData);
    setEditingIndex(null);
    setEditForm(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditForm(null);
  };

  const handleFormChange = (field: string, value: any) => {
    setEditForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleImport = async () => {
    if (!auth.currentUser) return setError("Please log in again.");

    setLoading(true);
    setError(null);

    try {
      const rawAgencyId = await getUserAgencyId();
      const agencyId = rawAgencyId || 'UNASSIGNED';

      const finalDataToImport = extractedData.filter(item => !existingLoansInfo.has(String(item.loanId)));

      if (finalDataToImport.length === 0) {
        throw new Error("All items in this list are already in your database (duplicate Loan IDs).");
      }

      // --- CREATE BATCH METADATA DOCUMENT ---
      const batchDocRef = doc(collection(db, 'batches'));
      const batchData = {
        id: batchDocRef.id,
        agencyId,
        fileName: file?.name || 'Unknown',
        filePath: extractedData.find(d => d.documentPath)?.documentPath || null,
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser.uid,
        totalRows: extractedData.length,
        importedRows: finalDataToImport.length,
        sourceType: file?.name.split('.').pop()?.toUpperCase() || 'UNKNOWN'
      };

      await setDoc(batchDocRef, batchData);

      // --- IMPORT FLAT LOANS DIRECTLY TO CUSTOMERS COLLECTION ---
      let batch = writeBatch(db);
      let operationCount = 0;

      for (const item of finalDataToImport) {
        const customerDocRef = doc(collection(db, 'customers'));
        
        batch.set(customerDocRef, {
          id: customerDocRef.id,
          agencyId, 
          name: item.name || 'Unknown',
          mobile: item.mobile || '',
          address: item.address || '', 
          loanId: item.loanId || '',
          
          // Support both legacy and new aggregate fields to keep the UI fully backwards compatible
          dueAmount: Number(item.dueAmount) || 0,
          totalDueAmount: Number(item.dueAmount) || 0,
          dueDate: item.dueDate || new Date().toISOString().split('T')[0],
          
          receivedAmount: 0,
          totalReceivedAmount: 0,
          status: 'Pending',
          assignedAgentId: auth.currentUser?.uid || null,
          batchId: batchDocRef.id,
          createdAt: new Date().toISOString(),
          needsReview: item.needsReview || false
        });
        
        operationCount++;

        // Commit chunk if we reach Firebase batch limits
        if (operationCount > 450) {
          await batch.commit();
          batch = writeBatch(db);
          operationCount = 0;
        }
      }

      // Commit any remaining operations
      if (operationCount > 0) {
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

  const loadingLabel = uploadProgress > 0 && uploadProgress < 100
    ? `Uploading securely... ${uploadProgress}%`
    : extractionStatus;

  // Calculate stats for UI using Map
  const duplicateCount = extractedData.filter(item => existingLoansInfo.has(String(item.loanId))).length;
  const validCount = extractedData.length - duplicateCount;

  return (
    <div className="p-6 space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Import Collections</h1>
        <p className="text-sm text-slate-500 font-medium">Upload Documents, Images, or Excel sheets</p>
      </div>

      <AnimatePresence mode="wait">
        {!extractedData.length && !processing && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="space-y-6"
          >
            <div
              {...getRootProps()}
              className={`premium-card p-12 border-dashed border-2 flex flex-col items-center justify-center text-center space-y-4 transition-colors cursor-pointer ${
                isDragActive ? 'border-brand-500 bg-brand-50' : 'border-slate-200'
              }`}
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
          </motion.div>
        )}

        {processing && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="flex flex-col items-center justify-center py-20 space-y-5"
          >
            <Loader2 size={48} className="text-brand-600 animate-spin" />
            <p className="font-bold text-slate-700 text-center">{loadingLabel}</p>
            <p className="text-xs text-slate-400 text-center max-w-xs">
              Large documents with many records can take 2–3 minutes. Please keep this screen open.
            </p>

            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="w-64 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-600 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            {uploadProgress === 100 && (
              <div className="flex space-x-1.5 mt-2">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 bg-brand-400 rounded-full"
                    animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {extractedData.length > 0 && !processing && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900">Extracted ({extractedData.length} records)</h2>
                {duplicateCount > 0 && (
                  <p className="text-xs text-amber-600 font-medium mt-1">
                    {duplicateCount} duplicate(s) found. They will be skipped on import.
                  </p>
                )}
              </div>
              <button
                onClick={() => { setExtractedData([]); setFile(null); }}
                className="text-brand-600 font-bold text-sm"
              >
                Clear
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 pb-10">
              {extractedData.map((item, i) => {
                const isEditing = editingIndex === i;
                const activeData = isEditing ? editForm : item;
                
                // Fetch duplicate info from the Map
                const duplicateInfo = existingLoansInfo.get(String(activeData.loanId));
                const isDuplicate = !!duplicateInfo;

                // --- EDIT MODE VIEW ---
                if (isEditing) {
                  return (
                    <div key={i} className="premium-card p-4 border-2 border-brand-500 shadow-lg space-y-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-slate-700 text-sm">Edit Record</span>
                        {isDuplicate && (
                          <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md">
                            ⚠️ Duplicate Loan ID (Batch: {duplicateInfo.batchId.substring(0, 8)}...)
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Customer Name</label>
                          <input type="text" value={editForm.name} onChange={e => handleFormChange('name', e.target.value)} className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                        </div>
                        
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Loan ID</label>
                          <input type="text" value={editForm.loanId} onChange={e => handleFormChange('loanId', e.target.value)} className={`w-full mt-1 px-3 py-2 bg-slate-50 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${isDuplicate ? 'border-red-400 text-red-700' : 'border-slate-200'}`} />
                        </div>
                        
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Mobile</label>
                          <input type="text" value={editForm.mobile} onChange={e => handleFormChange('mobile', e.target.value)} className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Due Amount</label>
                          <input type="number" value={editForm.dueAmount} onChange={e => handleFormChange('dueAmount', Number(e.target.value))} className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Due Date</label>
                          <input type="date" value={editForm.dueDate} onChange={e => handleFormChange('dueDate', e.target.value)} className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                        </div>

                        <div className="col-span-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Address</label>
                          <input type="text" value={editForm.address} onChange={e => handleFormChange('address', e.target.value)} className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                        </div>

                        <div className="col-span-2 flex items-center space-x-2 mt-1">
                          <input type="checkbox" id={`review-${i}`} checked={editForm.needsReview} onChange={e => handleFormChange('needsReview', e.target.checked)} className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500" />
                          <label htmlFor={`review-${i}`} className="text-sm font-medium text-slate-700 cursor-pointer">Needs Manual Review Flag</label>
                        </div>
                      </div>

                      <div className="flex justify-end space-x-2 mt-4 pt-4 border-t border-slate-100">
                        <button onClick={handleCancelEdit} className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 flex items-center">
                          <X size={14} className="mr-1" /> Cancel
                        </button>
                        <button onClick={() => handleSaveEdit(i)} className="px-4 py-2 text-sm font-bold text-white bg-brand-600 rounded-lg hover:bg-brand-700 flex items-center">
                          <Check size={14} className="mr-1" /> Save
                        </button>
                      </div>
                    </div>
                  );
                }

                // --- READ-ONLY VIEW ---
                return (
                  <div
                    key={i}
                    className={`premium-card p-4 border-l-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
                      isDuplicate 
                        ? 'border-red-400 bg-red-50/50 opacity-75' 
                        : item.needsReview
                          ? 'border-amber-400 bg-amber-50/30'
                          : 'border-brand-500'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className={`font-bold ${isDuplicate ? 'text-red-900 line-through' : 'text-slate-900'}`}>
                          {item.name}
                        </h4>
                        {item.needsReview && !isDuplicate && (
                          <span className="flex items-center text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                            <AlertTriangle size={10} className="mr-1" /> Review
                          </span>
                        )}
                        {isDuplicate && (
                          <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold" title={`From Batch: ${duplicateInfo.batchId}`}>
                            Duplicate (Batch: {duplicateInfo.batchId.substring(0, 8)}...)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        <span className={isDuplicate ? 'text-red-500 font-bold' : ''}>{item.loanId}</span> • {item.mobile}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                        {item.address}
                      </p>
                    </div>
                    
                    <div className="flex items-center justify-between sm:flex-col sm:items-end w-full sm:w-auto gap-2">
                      <div className="text-left sm:text-right">
                        <div className={`font-bold ${isDuplicate ? 'text-slate-400' : 'text-slate-900'}`}>
                          {formatCurrency(item.dueAmount)}
                        </div>
                        <div className="text-[10px] font-bold text-orange-600 uppercase">
                          Due: {item.dueDate}
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => handleEditClick(i, item)}
                        className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                        title="Edit Row"
                      >
                        <Edit2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleImport}
              disabled={loading || validCount === 0}
              className="w-full bg-brand-600 text-white p-5 rounded-2xl font-bold shadow-lg shadow-brand-100 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {loading ? "Saving to Database..." : `Import ${validCount} Valid Records`}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center space-x-3 border border-red-100"
        >
          <AlertCircle size={20} className="shrink-0" />
          <p className="text-xs font-bold">{error}</p>
        </motion.div>
      )}
    </div>
  );
}