// src/screens/SignupScreen.tsx
import { useState } from 'react';
import { UserPlus, ShieldCheck, Mail, Lock, User, Phone, Eye, EyeOff } from 'lucide-react';
// Added 'collection' to imports
import { auth, db, doc, setDoc, collection } from '../lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { Link } from 'react-router-dom';

export default function SignupScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const validatePassword = (pass: string) => {
    const regex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
    return regex.test(pass);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validatePassword(password)) {
      setError("Password must be at least 8 characters, with 1 uppercase, 1 number, and 1 special character.");
      return;
    }

    setLoading(true);
    try {
      // 1. Create User in Firebase Auth
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const user = cred.user;

      // 2. Update Auth Profile
      await updateProfile(user, { displayName: name });

      // 3. Create Firestore User Document
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: name,
        phone: phone,
        email: email,
        role: 'independent_agent', 
        agencyId: user.uid,        
        createdAt: new Date().toISOString(),
        active: true
      });

      // 4. PRE-SEED DEFAULT LOAN TEMPLATE/CAMPAIGN
      // Create a reference with an auto-generated ID in the 'templates' collection
      const templateRef = doc(collection(db, 'templates'));
      
      await setDoc(templateRef, {
        id: templateRef.id,
        agencyId: user.uid, // Ties this template to the new Independent Agent
        name: "Default Loan Collection",
        type: "loan",
        schema: {
          primaryDisplayField: "customerName",
          secondaryDisplayField: "loanId",
          fields: [
            { key: "customerName", label: "Name", type: "text" },
            { key: "mobile", label: "Mobile", type: "phone" },
            { key: "loanId", label: "Loan ID", type: "text" },
            { key: "totalDueAmount", label: "Due Amount", type: "currency" },
            { key: "dueDate", label: "Due Date", type: "date" }
          ]
        },
        actionConfig: {
          statuses: ["Pending", "Promise to Pay", "Partial Payment", "Full Payment", "Refused"],
          requiresLocation: true,
          requiresPhoto: false,
          nextFollowUpMandatoryFor: ["Promise to Pay", "Pending"]
        },
        isDefault: true,
        createdAt: new Date().toISOString()
      });

    } catch (e: any) {
      console.error("Signup failed", e);
      setError(e.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-100 p-8 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <ShieldCheck size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Create Account</h1>
            <p className="text-gray-500 font-medium tracking-tight mt-1">Register as an independent agent to get started</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-semibold text-center border border-red-100">
            {error}
          </div>
        )}

        {/* Signup Form */}
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Full Name *</label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-gray-400" size={20} />
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Ramesh Patel"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none transition-all" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Phone Number *</label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 text-gray-400" size={20} />
              <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 XXXXX XXXXX"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none transition-all" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Email Address *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="agent@agency.com"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none transition-all" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Password *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type={showPassword ? "text" : "password"}
                required value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none transition-all"
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Requires 8+ chars, 1 uppercase, 1 number, and 1 special character.
            </p>
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all disabled:opacity-50 mt-2 shadow-lg shadow-blue-200"
          >
            <UserPlus size={20} />
            <span>{loading ? "Creating Account..." : "Sign Up"}</span>
          </button>
        </form>

        <div className="text-center pt-2">
          <p className="text-sm text-gray-600 font-medium">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:underline font-bold">Log in here</Link>
          </p>
        </div>

      </div>
    </div>
  );
}