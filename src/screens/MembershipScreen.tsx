import { useNavigate } from 'react-router-dom';
import { useTrialStatus } from '../lib/useTrialStatus';
import { Check, Crown, AlertCircle } from 'lucide-react';

export default function MembershipScreen() {
  const navigate = useNavigate();
  const { isExpired, daysLeft } = useTrialStatus();

  return (
    <div className="p-6 space-y-8 pb-24">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-black text-slate-900">Pro Plan</h1>
        <p className="text-sm text-slate-500">Unlock full collection management</p>
      </div>

      {/* Dynamic Trial Status Banner */}
      <div className={`p-4 rounded-2xl flex items-center space-x-4 ${isExpired ? 'bg-red-50 border border-red-100' : 'bg-brand-50 border border-brand-100'}`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white ${isExpired ? 'bg-red-500' : 'bg-brand-600'}`}>
            {isExpired ? <AlertCircle size={24} /> : <Crown size={24} />}
          </div>
          <div>
            <h3 className={`font-black text-sm ${isExpired ? 'text-red-900' : 'text-brand-900'}`}>
              {isExpired ? 'Trial Expired' : 'Free Trial Active'}
            </h3>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${isExpired ? 'text-red-600' : 'text-brand-600'}`}>
              {isExpired ? 'Upgrade to continue' : `${daysLeft} days remaining`}
            </p>
          </div>
      </div>

      {/* Pricing Card */}
      <div className="bg-white border-2 border-brand-600 rounded-3xl p-6 shadow-xl shadow-brand-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 bg-brand-600 text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-bl-xl">
          Most Popular
        </div>
        
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-black text-slate-900">Monthly Pro</h2>
            <div className="flex items-end space-x-1 mt-2">
              <span className="text-4xl font-black text-brand-600">₹999</span>
              <span className="text-sm font-bold text-slate-400 mb-1">/month</span>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-100">
            <FeatureItem text="Unlimited Customer Profiles" />
            <FeatureItem text="Update Meeting & Collection Status" />
            <FeatureItem text="Advanced Analytics & Reports" />
            <FeatureItem text="Priority Follow-up Notifications" />
            <FeatureItem text="Premium WhatsApp Support" />
          </div>

          <button 
            onClick={() => navigate('/checkout')}
            className="w-full bg-brand-600 text-white rounded-xl py-4 font-black text-sm uppercase tracking-wider shadow-lg active:scale-95 transition-transform mt-4"
          >
            Buy Now
          </button>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <div className="flex items-center space-x-3">
      <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shrink-0">
        <Check size={12} strokeWidth={3} />
      </div>
      <span className="text-xs font-bold text-slate-600">{text}</span>
    </div>
  );
}