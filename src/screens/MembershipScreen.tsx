import { ReactNode } from 'react';
import { CheckCircle2, ShieldCheck, Crown, Zap, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export default function MembershipScreen() {
  const navigate = useNavigate();

  return (
    <div className="p-6 pt-12 space-y-8 pb-32">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-600 text-white rounded-4xl shadow-xl mb-4">
          <Crown size={32} />
        </div>
        <h1 className="text-3xl font-black text-slate-900 leading-tight">Go Professional Meta</h1>
        <p className="text-slate-500 font-medium max-w-62.5 mx-auto">Unlock advanced field collection tools & smart AI imports.</p>
      </div>

      <div className="premium-card relative overflow-hidden bg-brand-900 p-8 text-white space-y-6">
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-brand-600 rounded-full blur-3xl opacity-30" />
        
        <div className="space-y-1">
          <span className="text-brand-300 text-[10px] font-bold uppercase tracking-widest">Monthly Plan</span>
          <div className="flex items-baseline space-x-1">
            <span className="text-4xl font-black">₹999</span>
            <span className="text-brand-300 font-bold">/ agent</span>
          </div>
        </div>

        <div className="space-y-4">
          <FeatureItem label="Unlimited PDF/Excel AI Imports" />
          <FeatureItem label="Smart Visit Route Planning" />
          <FeatureItem label="Offline Collection Cache" />
          <FeatureItem label="Advanced Performance Reports" />
          <FeatureItem label="Cloud Document Storage (1GB)" />
        </div>

        <button className="w-full bg-white text-brand-900 p-5 rounded-2xl font-bold flex items-center justify-center space-x-2 shadow-xl active:scale-95 transition-transform">
          <span>Start 7-Day Free Trial</span>
          <ChevronRight size={20} />
        </button>

        <p className="text-center text-[10px] text-brand-300 font-medium">Cancel anytime. No lock-in period.</p>
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-slate-900">Why upgrade?</h3>
        <div className="grid grid-cols-2 gap-4">
          <BenefitCard 
            icon={<Zap className="text-orange-500" />} 
            title="3x Faster" 
            desc="AI extraction saves 2h daily" 
          />
          <BenefitCard 
            icon={<ShieldCheck className="text-emerald-500" />} 
            title="Audit Ready" 
            desc="Tamper proof visit proofs" 
          />
        </div>
      </div>

      <div className="bg-slate-900 p-6 rounded-3xl text-white flex items-center justify-between">
        <div className="space-y-1">
          <h4 className="font-bold text-sm">Enterprise for Teams?</h4>
          <p className="text-[10px] text-slate-400 font-medium">For agencies with 10+ agents</p>
        </div>
        <button className="bg-white/10 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider backdrop-blur-md">Contact Sales</button>
      </div>
    </div>
  );
}

function FeatureItem({ label }: { label: string }) {
  return (
    <div className="flex items-center space-x-3">
      <div className="bg-emerald-400/20 p-1 rounded-full">
        <CheckCircle2 size={16} className="text-emerald-400" />
      </div>
      <span className="text-sm font-medium text-brand-100">{label}</span>
    </div>
  );
}

function BenefitCard({ icon, title, desc }: { icon: ReactNode; title: string, desc: string }) {
  return (
    <div className="premium-card p-4 space-y-2">
      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
        {icon}
      </div>
      <h4 className="font-bold text-xs">{title}</h4>
      <p className="text-[10px] font-medium text-slate-400 leading-tight">{desc}</p>
    </div>
  );
}
