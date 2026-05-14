import { motion } from 'motion/react';
import { ShieldCheck } from 'lucide-react';

export default function SplashScreen() {
  return (
    <div className="h-screen w-full bg-brand-600 flex flex-col items-center justify-center text-white">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="flex flex-col items-center space-y-4"
      >
        <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl">
          <ShieldCheck size={64} className="text-brand-600" />
        </div>
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">ProCollect</h1>
          <p className="text-brand-100 font-medium tracking-widest uppercase text-xs mt-2">
            Smart Collection Management
          </p>
        </div>
      </motion.div>
      
      <div className="absolute bottom-12 flex flex-col items-center space-y-4">
        <div className="w-12 h-1 bg-brand-400 rounded-full overflow-hidden">
          <motion.div 
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            className="w-full h-full bg-white"
          />
        </div>
        <span className="text-brand-100 text-[10px] font-bold uppercase tracking-widest">
          Premium Field Edition
        </span>
      </div>
    </div>
  );
}
