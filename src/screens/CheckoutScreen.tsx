import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, CreditCard } from 'lucide-react';

export default function CheckoutScreen() {
  const navigate = useNavigate();

  const handleRazorpay = () => {
    // Replace this string with your actual Razorpay Payment Link
    window.location.href = "https://rzp.io/l/your_payment_link_here"; 
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 pb-20">
      <div className="bg-white px-6 py-4 border-b border-slate-100 flex items-center space-x-4">
        <button onClick={() => navigate(-1)} className="text-slate-400 active:text-slate-600">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg font-black text-slate-900">Checkout</h1>
      </div>

      <div className="p-6 flex-1 space-y-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Order Summary</h2>
          
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-black text-slate-900">ProCollect Monthly</h3>
              <p className="text-xs text-slate-500 font-medium">Billed every month</p>
            </div>
            <div className="text-right">
              <span className="font-black text-brand-600">₹999</span>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
            <span className="font-bold text-slate-900">Total</span>
            <span className="text-xl font-black text-slate-900">₹999.00</span>
          </div>
        </div>

        <div className="flex items-start space-x-3 text-emerald-600 bg-emerald-50 p-4 rounded-xl border border-emerald-100">
          <ShieldCheck size={20} className="shrink-0 mt-0.5" />
          <p className="text-xs font-bold leading-relaxed">
            Safe & secure payment powered by Razorpay. Cancel anytime from your account settings.
          </p>
        </div>
      </div>

      <div className="p-6 bg-white border-t border-slate-100">
        <button 
          onClick={handleRazorpay}
          className="w-full bg-slate-900 text-white rounded-xl py-4 font-black text-sm uppercase tracking-wider shadow-xl active:scale-95 transition-transform flex items-center justify-center space-x-3"
        >
          <CreditCard size={18} />
          <span>Pay via Razorpay</span>
        </button>
      </div>
    </div>
  );
}