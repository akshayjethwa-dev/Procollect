import { useState } from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
import { auth, db, doc, setDoc, getDoc, signInWithPopup, GoogleAuthProvider } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoginSuccess = async (user: any) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        // Initialize new users with a default 'agent' role
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name: user.displayName || 'Agent',
          email: user.email || '',
          role: 'agent', // <-- Default role assigned here
          createdAt: new Date().toISOString(),
        });
      }
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      await handleLoginSuccess(cred.user);
    } catch (e: any) {
      console.error("Login failed", e);
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8">
      <div className="max-w-sm w-full space-y-12">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="w-20 h-20 bg-brand-600 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-brand-200">
            <ShieldCheck size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tight text-slate-900">ProCollect</h1>
            <p className="text-slate-500 font-medium tracking-tight">Smart Debt Recovery & Field Agency App</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-slate-900 text-white p-6 rounded-4xl font-bold flex items-center justify-center space-x-4 shadow-xl active:scale-95 transition-all disabled:opacity-50"
            >
              <LogIn size={24} />
              <span className="text-lg">{loading ? "Authenticating..." : "Login with Google"}</span>
            </button>
            <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest px-4">
              Authorized personnel only. Access is monitored and recorded.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold text-center border border-red-100 italic">
              {error}
            </div>
          )}
        </div>

        <div className="pt-20">
          <div className="grid grid-cols-2 gap-8 text-center opacity-40 grayscale">
            <div className="space-y-1">
              <div className="text-slate-900 font-black text-xl">100%</div>
              <div className="text-[8px] font-bold uppercase tracking-widest">Secure Cloud</div>
            </div>
            <div className="space-y-1">
              <div className="text-slate-900 font-black text-xl">Live</div>
              <div className="text-[8px] font-bold uppercase tracking-widest">Tracking</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}