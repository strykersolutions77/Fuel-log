import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Settings, 
  History, 
  Home,
  X,
  Camera,
  LogOut,
  ChevronRight,
  TrendingUp,
  Trash2,
  Droplets,
  Flame,
  Clock,
  Edit2,
  Check,
  AlertTriangle,
  Info
} from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { User } from 'firebase/auth';
import { signIn, signOut, subscribeToDailyLogs, logFood, updateGoals, logWeight, deleteFoodLog, logWater, subscribeToDailyWater, getHistoricalLogs, getRecentFoodLogs } from './firebase';
import { FoodLog, NutritionEstimate, UserProfile, WaterLog, FoodCategory } from './types';
import { estimateNutrition } from './lib/gemini';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, Cell } from 'recharts';
import TDEECalculator from './components/TDEECalculator';
import { COMMON_FOODS } from './data/commonFoods';

// --- Error Boundary ---

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error && parsed.error.includes("insufficient permissions")) {
          errorMessage = "You don't have permission to perform this action. Please check your account status.";
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="h-screen flex flex-col items-center justify-center p-6 text-center bg-zinc-950">
          <X className="text-red-500 mb-4" size={48} />
          <h1 className="text-2xl font-bold text-zinc-100 mb-2">Oops!</h1>
          <p className="text-zinc-400 mb-6">{errorMessage}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-zinc-100 text-zinc-950 rounded-2xl font-bold"
          >
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Components ---

const ProgressCircle = ({ current, goal, label, color, unit = '' }: { current: number, goal: number, label: string, color: string, unit?: string }) => {
  const percentage = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  const strokeDasharray = 251.2; // 2 * pi * 40
  const strokeDashoffset = strokeDasharray - (strokeDasharray * percentage) / 100;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-zinc-800"
          />
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke={color}
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold leading-none text-zinc-100">{Math.round(current)}</span>
          <span className="text-[10px] text-zinc-500 uppercase">{unit}</span>
        </div>
      </div>
      <span className="mt-2 text-xs font-medium text-zinc-400 uppercase tracking-wider">{label}</span>
    </div>
  );
};

const FoodItem = ({ log, onDelete }: { log: FoodLog, onDelete: (id: string) => void }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <div className="relative mb-3 overflow-hidden rounded-2xl group">
      {/* Background Delete Layer */}
      <div 
        className="absolute inset-0 bg-red-600 flex items-center justify-end px-6 cursor-pointer"
        onClick={() => onDelete(log.id)}
      >
        <div className="flex flex-col items-center gap-1">
          <Trash2 size={20} className="text-white" />
          <span className="text-[10px] font-bold text-white uppercase tracking-tighter">Delete</span>
        </div>
      </div>

      {/* Foreground Content Layer */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ 
          opacity: 1, 
          y: 0,
          x: isDeleting ? -80 : 0 
        }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        className="relative bg-zinc-900 border border-zinc-800 z-10"
      >
        <div 
          className="flex items-center justify-between p-4 cursor-pointer select-none"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            {log.imageUrl ? (
              <img src={log.imageUrl} alt={log.name} className="w-12 h-12 rounded-xl object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                <Search size={20} />
              </div>
            )}
            <div>
              <h4 className="font-semibold text-zinc-100">{log.name}</h4>
              <p className="text-xs text-zinc-500">{log.portion}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-bold text-zinc-100">{log.calories} kcal</p>
              <p className="text-[10px] text-zinc-500">
                P: {log.protein}g · C: {log.carbs}g · F: {log.fats}g
              </p>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsDeleting(!isDeleting); }}
              className="p-2 text-zinc-700 hover:text-red-500 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && log.reasoning && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-4 pb-4 overflow-hidden"
            >
              <div className="pt-3 border-t border-zinc-800">
                <div className="flex items-start gap-2">
                  <Info size={12} className="text-orange-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-zinc-400 italic leading-relaxed">
                    {log.reasoning}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

const CalorieTracker = ({ current, goal }: { current: number, goal: number }) => {
  const isOverGoal = goal > 0 && current > goal;
  const percentage = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  const remaining = Math.max(0, goal - current);
  
  return (
    <div className="bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-800 mb-8 relative overflow-hidden flex flex-col md:flex-row items-center gap-8">
      {/* Bubble Container */}
      <div className="relative w-40 h-40 rounded-full border-4 border-zinc-800 bg-zinc-950 overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
        {/* Warning Flag */}
        <AnimatePresence>
          {isOverGoal && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.5, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 10 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-red-500 text-white px-2 py-1 rounded-full flex items-center gap-1 shadow-lg"
            >
              <AlertTriangle size={10} />
              <span className="text-[8px] font-black uppercase tracking-tighter">Limit Exceeded</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Calorie Fill */}
        <motion.div 
          initial={{ height: 0 }}
          animate={{ height: `${percentage}%` }}
          transition={{ type: 'spring', damping: 20, stiffness: 50 }}
          className={`absolute bottom-0 left-0 right-0 ${isOverGoal ? 'bg-red-500/80' : 'bg-orange-500/80'} backdrop-blur-sm`}
        />
        
        {/* Percentage Text Overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <span className="text-2xl font-black text-white drop-shadow-md">{Math.round((current / goal) * 100)}%</span>
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left">
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-1 justify-center md:justify-start">
            <Flame className="text-orange-500" size={16} />
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Energy</h3>
          </div>
          <p className="text-3xl font-black text-zinc-100">
            {current} <span className="text-sm font-normal text-zinc-500">/ {goal} kcal</span>
          </p>
        </div>
        
        <div className="p-3 bg-zinc-950/50 rounded-2xl border border-zinc-800 inline-block">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Remaining</p>
          <p className={`text-xl font-black ${remaining > 0 ? 'text-orange-500' : 'text-red-500'}`}>
            {remaining} <span className="text-xs font-normal opacity-50">kcal</span>
          </p>
        </div>
      </div>
    </div>
  );
};

const WaterTracker = ({ current, goal, onAdd }: { current: number, goal: number, onAdd: (amount: number) => void }) => {
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const isOverGoal = goal > 0 && current > goal;
  const percentage = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  
  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(customValue);
    if (!isNaN(amount) && amount > 0) {
      onAdd(amount);
      setCustomValue('');
      setIsCustom(false);
    }
  };

  return (
    <div className="bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-800 mb-8 relative overflow-hidden flex flex-col md:flex-row items-center gap-8">
      {/* Bubble Container */}
      <div className="relative w-40 h-40 rounded-full border-4 border-zinc-800 bg-zinc-950 overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
        {/* Warning Flag */}
        <AnimatePresence>
          {isOverGoal && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.5, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 10 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-blue-400 text-white px-2 py-1 rounded-full flex items-center gap-1 shadow-lg"
            >
              <AlertTriangle size={10} />
              <span className="text-[8px] font-black uppercase tracking-tighter">Goal Achieved+</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Water Fill */}
        <motion.div 
          initial={{ height: 0 }}
          animate={{ height: `${percentage}%` }}
          transition={{ type: 'spring', damping: 20, stiffness: 50 }}
          className="absolute bottom-0 left-0 right-0 bg-blue-500/80 backdrop-blur-sm"
        />

        {/* Percentage Text Overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <span className="text-2xl font-black text-white drop-shadow-md">{Math.round((current / goal) * 100)}%</span>
        </div>
      </div>

      {/* Info & Controls */}
      <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1 justify-center md:justify-start">
            <Droplets className="text-blue-500" size={16} />
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Hydration</h3>
          </div>
          <p className="text-3xl font-black text-zinc-100">
            {current} <span className="text-sm font-normal text-zinc-500">/ {goal} oz</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2 justify-center md:justify-start">
          {[8, 16].map(amount => (
            <button 
              key={amount}
              onClick={() => onAdd(amount)}
              className="px-4 py-3 bg-blue-500/10 text-blue-500 rounded-2xl font-bold text-sm border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all active:scale-95 flex items-center gap-2"
            >
              <Plus size={14} />
              {amount}oz
            </button>
          ))}
          
          {isCustom ? (
            <form onSubmit={handleCustomSubmit} className="flex gap-2">
              <input
                autoFocus
                type="number"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                placeholder="oz"
                className="w-20 px-4 py-3 bg-zinc-800 border border-blue-500/30 rounded-2xl text-sm font-bold text-zinc-100 focus:outline-none focus:border-blue-500"
              />
              <button 
                type="submit"
                className="px-4 py-3 bg-blue-500 text-white rounded-2xl font-bold text-sm hover:bg-blue-600 transition-all active:scale-95"
              >
                Add
              </button>
              <button 
                type="button"
                onClick={() => setIsCustom(false)}
                className="p-3 text-zinc-500 hover:text-zinc-300"
              >
                <X size={16} />
              </button>
            </form>
          ) : (
            <button 
              onClick={() => setIsCustom(true)}
              className="px-4 py-3 bg-blue-500/10 text-blue-500 rounded-2xl font-bold text-sm border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all active:scale-95 flex items-center gap-2"
            >
              <Edit2 size={14} />
              Custom
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const { user, profile, loading, error: authError } = useAuth();
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([]);
  const [view, setView] = useState<'home' | 'search' | 'settings'>('home');
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalWater, setTotalWater] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    const now = new Date();
    const nextReset = new Date();
    nextReset.setHours(1, 0, 0, 0);
    if (now >= nextReset) {
      nextReset.setDate(nextReset.getDate() + 1);
    }
    const timeToReset = nextReset.getTime() - now.getTime();
    const timer = setTimeout(() => {
      setResetKey(prev => prev + 1);
    }, timeToReset);
    return () => clearTimeout(timer);
  }, [resetKey]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  useEffect(() => {
    if (user) {
      const unsubscribeLogs = subscribeToDailyLogs(user.uid, (newLogs) => {
        setLogs(newLogs);
      }, (err) => {
        console.error("Logs subscription error:", err);
        setError("Failed to sync food logs. Please check your connection.");
      });
      const unsubscribeWater = subscribeToDailyWater(user.uid, (newWaterLogs) => {
        setWaterLogs(newWaterLogs);
        const total = newWaterLogs.reduce((acc, log) => acc + log.amount, 0);
        setTotalWater(total);
      }, (err) => {
        console.error("Water subscription error:", err);
        setError("Failed to sync water logs.");
      });
      return () => {
        unsubscribeLogs();
        unsubscribeWater();
      };
    }
  }, [user, resetKey]);

  if (loading) return <div className="h-screen flex items-center justify-center bg-zinc-950 text-zinc-400 font-sans">Loading...</div>;

  if (!user || !profile) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-zinc-950 p-6 font-sans">
        <div className="w-20 h-20 bg-orange-500 rounded-3xl flex items-center justify-center text-white mb-8 shadow-xl shadow-orange-500/20">
          <TrendingUp size={40} />
        </div>
        <h1 className="text-4xl font-black text-zinc-100 mb-2 tracking-tight">Fuel Log</h1>
        <p className="text-zinc-500 mb-6 text-center max-w-xs">The nutrition tracker that actually cares (and judges) what you eat.</p>
        
        {authError && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-sm font-bold max-w-xs text-center">
            {authError}
          </div>
        )}

        <button 
          onClick={signIn}
          className="w-full max-w-xs py-4 bg-zinc-100 text-zinc-950 rounded-2xl font-bold text-lg shadow-lg hover:bg-zinc-200 transition-all flex items-center justify-center gap-3"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          Continue with Google
        </button>
      </div>
    );
  }

  const dailyStats = logs.reduce((acc, log) => ({
    calories: acc.calories + log.calories,
    protein: acc.protein + log.protein,
    carbs: acc.carbs + log.carbs,
    fats: acc.fats + log.fats,
    alcohol: acc.alcohol + (log.alcohol || 0),
  }), { calories: 0, protein: 0, carbs: 0, fats: 0, alcohol: 0 });

  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-zinc-100">
      <AnimatePresence>
        {!profile.isSetupComplete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-950 z-[100] overflow-y-auto"
          >
            <TDEECalculator profile={profile} isInitialSetup={true} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="p-4 grid grid-cols-3 items-center bg-zinc-900 border-b border-zinc-800 sticky top-0 z-50">
        {/* Left: Nav */}
        <div className="flex items-center">
          <nav className="flex items-center gap-1 bg-zinc-950 p-1 rounded-2xl border border-zinc-800">
            <button 
              onClick={() => setView('home')}
              className={`p-2 rounded-xl transition-all ${view === 'home' ? 'bg-orange-500 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Home"
            >
              <Home size={18} />
            </button>
            <button 
              onClick={() => setView('search')}
              className={`p-2 rounded-xl transition-all ${view === 'search' ? 'bg-orange-500 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Search"
            >
              <Search size={18} />
            </button>
            <button 
              onClick={() => setView('settings')}
              className={`p-2 rounded-xl transition-all ${view === 'settings' ? 'bg-orange-500 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Settings"
            >
              <Settings size={18} />
            </button>
          </nav>
        </div>

        {/* Center: Title */}
        <div className="text-center">
          <h2 className="text-xl font-black text-lime-400 tracking-tight leading-none">Fuel Log</h2>
          <p className="text-[10px] text-lime-600 font-bold uppercase tracking-widest mt-1">Daily Tracker</p>
        </div>

        {/* Right: User Info */}
        <div className="flex items-center justify-end gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-lime-400">{profile.displayName}</p>
            <p className="text-[10px] text-lime-600">{profile.email}</p>
          </div>
          <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center text-xs font-bold text-lime-400 border border-zinc-700">
            {profile.displayName[0]}
          </div>
        </div>
      </header>

      <main className="p-6 max-w-2xl mx-auto">
        {view === 'home' && (
          <>
            <CalorieTracker 
              current={dailyStats.calories} 
              goal={profile?.goals.calories || 2000} 
            />

            <WaterTracker 
              current={totalWater} 
              goal={profile?.goals.water || 128} 
              onAdd={(amount) => user && logWater(user.uid, amount)}
            />

            {/* Daily Stats Grid */}
            <div className="bg-zinc-900 p-6 rounded-[2rem] border border-zinc-800 mb-8">
              <div className="grid grid-cols-3 gap-4">
                <ProgressCircle 
                  current={dailyStats.protein} 
                  goal={profile?.goals.protein || 150} 
                  label="Protein" 
                  color="#3b82f6" 
                  unit="g"
                />
                <ProgressCircle 
                  current={dailyStats.carbs} 
                  goal={profile?.goals.carbs || 200} 
                  label="Carbs" 
                  color="#10b981" 
                  unit="g"
                />
                <ProgressCircle 
                  current={dailyStats.fats} 
                  goal={profile?.goals.fats || 65} 
                  label="Fats" 
                  color="#eab308" 
                  unit="g"
                />
              </div>
              {dailyStats.alcohol > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-800 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Alcohol</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-zinc-100">{dailyStats.alcohol}g</p>
                    <p className="text-[10px] text-purple-500 font-bold uppercase tracking-tighter">
                      {Math.round(dailyStats.alcohol * 7)} kcal
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Food Log */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-zinc-100">Today's Log</h3>
              <span className="text-xs font-bold text-zinc-500 uppercase">{logs.length} items</span>
            </div>
            
            {logs.length === 0 ? (
              <div className="text-center py-12 bg-zinc-900 rounded-3xl border border-dashed border-zinc-800">
                <p className="text-zinc-500 italic">Nothing logged yet. Don't starve yourself.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Drinks'].map(category => {
                  const categoryLogs = logs.filter(log => log.category === category || (!log.category && category === 'Snack'));
                  if (categoryLogs.length === 0) return null;
                  
                  return (
                    <div key={category} className="space-y-3">
                      <div className="flex items-center gap-2 px-2">
                        <div className="w-1 h-4 bg-orange-500 rounded-full" />
                        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest">{category}</h3>
                        <span className="text-[10px] font-bold text-zinc-700 ml-auto">
                          {categoryLogs.reduce((acc, log) => acc + log.calories, 0)} kcal
                        </span>
                      </div>
                      <div className="space-y-3">
                        {categoryLogs.map(log => (
                          <FoodItem key={log.id} log={log} onDelete={deleteFoodLog} />
                        ))}
                      </div>
                    </div>
                  );
                })}
                {/* Fallback for any logs that might not match (though filter above handles it) */}
                {logs.filter(log => !['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Drinks'].includes(log.category || '')).length > 0 && (
                   <div className="space-y-3">
                    <div className="flex items-center gap-2 px-2">
                      <div className="w-1 h-4 bg-zinc-700 rounded-full" />
                      <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest">Other</h3>
                    </div>
                    {logs.filter(log => !['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Drinks'].includes(log.category || '')).map(log => (
                      <FoodItem key={log.id} log={log} onDelete={deleteFoodLog} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {view === 'search' && (
          <FoodSearchView 
            onClose={() => setView('home')} 
            user={user}
            onLog={async (food) => {
              if (!user) return;
              setIsProcessing(true);
              setError(null);
              try {
                await logFood(user.uid, food);
                setView('home');
              } catch (e) {
                console.error(e);
                setError("Failed to log food. Please check your connection.");
                throw e;
              } finally {
                setIsProcessing(false);
              }
            }} 
          />
        )}

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-24 left-6 right-6 bg-red-500 text-white p-4 rounded-2xl font-bold shadow-xl z-50 flex justify-between items-center"
            >
              <span>{error}</span>
              <button onClick={() => setError(null)}><X size={18} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isProcessing && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center"
            >
              <div className="bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-800 flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-zinc-100 font-bold">Logging meal...</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {view === 'settings' && (
          <SettingsView 
            profile={profile!} 
            onClose={() => setView('home')} 
            onLogout={signOut}
          />
        )}
      </main>
    </div>
  );
}

// --- Sub-Views ---

function FoodSearchView({ onClose, onLog, user }: { onClose: () => void, onLog: (food: any) => void, user: User | null }) {
  const [query, setQuery] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimate, setEstimate] = useState<NutritionEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isManual, setIsManual] = useState(false);
  const [recentFoodLogs, setRecentFoodLogs] = useState<FoodLog[]>([]);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [verifiedResults, setVerifiedResults] = useState<NutritionEstimate[]>([]);
  const [manualFood, setManualFood] = useState({
    name: '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
    alcohol: 0,
    portion: '1 serving',
    category: 'Breakfast' as FoodCategory
  });

  const CATEGORIES: FoodCategory[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Drinks'];

  useEffect(() => {
    if (user) {
      setIsFetchingHistory(true);
      getRecentFoodLogs(user.uid)
        .then(setRecentFoodLogs)
        .finally(() => setIsFetchingHistory(false));
    }
  }, [user]);

  // Auto-calculate calories for manual entry
  useEffect(() => {
    const calculated = Math.round((manualFood.protein * 4) + (manualFood.carbs * 4) + (manualFood.fats * 9) + (manualFood.alcohol * 7));
    if (calculated !== manualFood.calories && (manualFood.protein > 0 || manualFood.carbs > 0 || manualFood.fats > 0 || manualFood.alcohol > 0)) {
      setManualFood(prev => ({ ...prev, calories: calculated }));
    }
  }, [manualFood.protein, manualFood.carbs, manualFood.fats, manualFood.alcohol]);

  // Auto-calculate calories for AI estimate/adjustment
  useEffect(() => {
    if (estimate) {
      const calculated = Math.round((estimate.protein * 4) + (estimate.carbs * 4) + (estimate.fats * 9) + ((estimate.alcohol || 0) * 7));
      if (calculated !== estimate.calories && (estimate.protein > 0 || estimate.carbs > 0 || estimate.fats > 0 || (estimate.alcohol || 0) > 0)) {
        setEstimate(prev => prev ? { ...prev, calories: calculated } : null);
      }
    }
  }, [estimate?.protein, estimate?.carbs, estimate?.fats, estimate?.alcohol]);

  const [loadingMessage, setLoadingMessage] = useState('AI is analyzing your meal...');

  useEffect(() => {
    if (isEstimating) {
      const messages = [
        "Consulting nutrition database...",
        "Verifying portion sizes...",
        "Calculating macro breakdown...",
        "Thinking like a coach...",
        "Finalizing your nutrition plan..."
      ];
      let i = 0;
      const interval = setInterval(() => {
        i = (i + 1) % messages.length;
        setLoadingMessage(messages[i]);
      }, 1500);
      return () => clearInterval(interval);
    } else {
      setLoadingMessage('AI is analyzing your meal...');
    }
  }, [isEstimating]);

  useEffect(() => {
    if (query.trim().length > 1) {
      const filtered = COMMON_FOODS.filter(f => 
        f.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5);
      setVerifiedResults(filtered);
    } else if (query.trim().length === 0) {
      // Show featured staples when empty
      const featured = ["Chicken Breast", "Egg (Large)", "Salmon", "Avocado", "Greek Yogurt (Non-fat)"];
      setVerifiedResults(COMMON_FOODS.filter(f => featured.includes(f.name)).slice(0, 5));
    } else {
      setVerifiedResults([]);
    }
  }, [query]);

  const handleSearch = useCallback(async () => {
    if (!query && !image) return;
    setIsEstimating(true);
    setError(null);
    setEstimate(null);
    try {
      let imgInput: any = undefined;
      if (image) {
        imgInput = { data: image.split(',')[1], mimeType: 'image/jpeg' };
      }
      const result = await estimateNutrition(query || undefined, imgInput);
      setEstimate({ ...result, category: 'Breakfast' });
    } catch (e) {
      console.error(e);
      setError("AI failed to analyze your meal. Try manual entry.");
    } finally {
      setIsEstimating(false);
    }
  }, [query, image]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.7);
          setImage(compressed);
          // Auto-search after image is set
          setTimeout(() => {
            // We need to use the compressed image directly here or rely on the next render
            // But since handleSearch uses the 'image' state, we can just trigger it
          }, 100);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Trigger search when image changes
  useEffect(() => {
    if (image && !isEstimating && !estimate) {
      handleSearch();
    }
  }, [image, isEstimating, estimate, handleSearch]);

  const [isLogging, setIsLogging] = useState(false);

  const handleManualLog = async () => {
    if (!manualFood.name || manualFood.calories <= 0) {
      setError("Please provide a name and calories.");
      return;
    }
    setIsLogging(true);
    try {
      await onLog(manualFood);
    } finally {
      setIsLogging(false);
    }
  };

  const handleAILog = async () => {
    if (!estimate) return;
    setIsLogging(true);
    setError(null);
    try {
      await onLog({ ...estimate, imageUrl: image });
    } catch (e) {
      setError("Failed to log food. Please try again.");
    } finally {
      setIsLogging(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-950 z-30 p-6 overflow-y-auto text-zinc-100">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-black text-zinc-100 tracking-tight">Add Food</h2>
        <button onClick={onClose} className="p-2 bg-zinc-900 rounded-xl"><X size={20} /></button>
      </div>

      <div className="flex gap-2 mb-6 p-1 bg-zinc-900 rounded-2xl">
        <button 
          onClick={() => setIsManual(false)}
          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${!isManual ? 'bg-orange-500 text-white shadow-lg' : 'text-zinc-500'}`}
        >
          AI Search
        </button>
        <button 
          onClick={() => setIsManual(true)}
          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${isManual ? 'bg-orange-500 text-white shadow-lg' : 'text-zinc-500'}`}
        >
          Manual Entry
        </button>
      </div>

      {!isManual ? (
        <div className="space-y-6">
          <div className="relative">
            <input 
              type="text" 
              placeholder="What did you eat? (e.g. 2 eggs and toast)"
              className="w-full p-5 bg-zinc-900 rounded-2xl border border-zinc-800 focus:ring-2 focus:ring-orange-500 font-medium text-zinc-100 placeholder:text-zinc-600"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button 
              onClick={handleSearch}
              disabled={isEstimating}
              className="absolute right-3 top-3 p-2 bg-orange-500 text-white rounded-xl"
            >
              <Search size={20} />
            </button>
          </div>

          <div className="flex gap-4">
            <label className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-900 rounded-3xl border-2 border-dashed border-zinc-800 cursor-pointer hover:bg-zinc-800/50 transition-all">
              <Camera className="text-zinc-500 mb-2" />
              <span className="text-xs font-bold text-zinc-500 uppercase">Upload Photo</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
          </div>

          {image && (
            <div className="relative rounded-3xl overflow-hidden aspect-video shadow-lg">
              <img src={image} className="w-full h-full object-cover" alt="Food" />
              <button onClick={() => { setImage(null); setEstimate(null); }} className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full"><X size={16} /></button>
            </div>
          )}

          {verifiedResults.length > 0 && !estimate && !isEstimating && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-zinc-500 mb-2">
                <Check size={14} className="text-lime-500" />
                <h3 className="text-xs font-bold uppercase tracking-widest">
                  {query.trim().length === 0 ? 'Featured Staples' : 'Verified Database'}
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {verifiedResults.map((food, idx) => (
                  <button
                    key={`verified-${idx}`}
                    onClick={() => setEstimate({ ...food, category: 'Breakfast' })}
                    className="flex items-center justify-between p-4 bg-zinc-900 rounded-2xl border border-zinc-800 hover:border-lime-500/50 transition-all text-left group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-zinc-100">{food.name}</h4>
                        <span className="text-[10px] bg-lime-500/10 text-lime-500 px-1.5 py-0.5 rounded-md font-bold uppercase">Verified</span>
                      </div>
                      <p className="text-xs text-zinc-500">{food.portion} • {food.calories} kcal</p>
                    </div>
                    <Plus size={18} className="text-lime-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {isEstimating && (
            <div className="py-12 text-center space-y-4">
              <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-zinc-500 font-medium animate-pulse">{loadingMessage}</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-center text-sm font-bold">
              {error}
            </div>
          )}

          {estimate && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-orange-500/10 p-6 rounded-[2rem] border border-orange-500/20"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <input 
                    type="text"
                    className="text-xl font-black text-zinc-100 bg-transparent border-none focus:ring-0 p-0 w-full"
                    value={estimate.name}
                    onChange={(e) => setEstimate({ ...estimate, name: e.target.value })}
                  />
                  <input 
                    type="text"
                    className="text-sm text-orange-500 font-bold uppercase tracking-widest bg-transparent border-none focus:ring-0 p-0 w-full"
                    value={estimate.portion}
                    onChange={(e) => setEstimate({ ...estimate, portion: e.target.value })}
                  />
                </div>
                <div className="p-2 bg-orange-500/20 rounded-xl text-orange-500">
                  <Edit2 size={16} />
                </div>
              </div>
              
              <div className="grid grid-cols-5 gap-2 mb-6">
                <div className="text-center">
                  <input 
                    type="number"
                    className="w-full text-lg font-bold text-zinc-100 bg-zinc-950/50 rounded-lg border-none focus:ring-1 focus:ring-orange-500 text-center p-1"
                    value={estimate.calories === 0 ? '' : estimate.calories}
                    placeholder="0"
                    onChange={(e) => setEstimate({ ...estimate, calories: parseFloat(e.target.value) || 0 })}
                  />
                  <p className="text-[10px] text-zinc-500 uppercase mt-1">Kcal</p>
                </div>
                <div className="text-center">
                  <input 
                    type="number"
                    className="w-full text-lg font-bold text-zinc-100 bg-zinc-950/50 rounded-lg border-none focus:ring-1 focus:ring-orange-500 text-center p-1"
                    value={estimate.protein === 0 ? '' : estimate.protein}
                    placeholder="0"
                    onChange={(e) => setEstimate({ ...estimate, protein: parseFloat(e.target.value) || 0 })}
                  />
                  <p className="text-[10px] text-zinc-500 uppercase mt-1">Prot</p>
                </div>
                <div className="text-center">
                  <input 
                    type="number"
                    className="w-full text-lg font-bold text-zinc-100 bg-zinc-950/50 rounded-lg border-none focus:ring-1 focus:ring-orange-500 text-center p-1"
                    value={estimate.carbs === 0 ? '' : estimate.carbs}
                    placeholder="0"
                    onChange={(e) => setEstimate({ ...estimate, carbs: parseFloat(e.target.value) || 0 })}
                  />
                  <p className="text-[10px] text-zinc-500 uppercase mt-1">Carbs</p>
                </div>
                <div className="text-center">
                  <input 
                    type="number"
                    className="w-full text-lg font-bold text-zinc-100 bg-zinc-950/50 rounded-lg border-none focus:ring-1 focus:ring-orange-500 text-center p-1"
                    value={estimate.fats === 0 ? '' : estimate.fats}
                    placeholder="0"
                    onChange={(e) => setEstimate({ ...estimate, fats: parseFloat(e.target.value) || 0 })}
                  />
                  <p className="text-[10px] text-zinc-500 uppercase mt-1">Fats</p>
                </div>
                <div className="text-center">
                  <input 
                    type="number"
                    className="w-full text-lg font-bold text-zinc-100 bg-zinc-950/50 rounded-lg border-none focus:ring-1 focus:ring-orange-500 text-center p-1"
                    value={(estimate.alcohol || 0) === 0 ? '' : estimate.alcohol}
                    placeholder="0"
                    onChange={(e) => setEstimate({ ...estimate, alcohol: parseFloat(e.target.value) || 0 })}
                  />
                  <p className="text-[10px] text-zinc-500 uppercase mt-1">Alc</p>
                </div>
              </div>

              <div className="mb-6">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setEstimate({ ...estimate, category: cat })}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all ${estimate.category === cat ? 'bg-orange-500 text-white' : 'bg-zinc-950/50 text-zinc-500 hover:text-zinc-300'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {estimate.reasoning && (
                <textarea 
                  className="w-full text-xs text-zinc-400 italic mb-6 leading-relaxed bg-transparent border-none focus:ring-0 p-0 resize-none h-12"
                  value={estimate.reasoning}
                  onChange={(e) => setEstimate({ ...estimate, reasoning: e.target.value })}
                />
              )}

              <button 
                onClick={handleAILog}
                disabled={isLogging}
                className="w-full py-4 bg-zinc-100 text-zinc-950 rounded-2xl font-bold shadow-lg disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isLogging ? (
                  <>
                    <div className="w-5 h-5 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                    Logging...
                  </>
                ) : (
                  <>
                    <Check size={20} />
                    Log This Meal
                  </>
                )}
              </button>
            </motion.div>
          )}

          {!estimate && !isEstimating && recentFoodLogs.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-zinc-500 mb-2">
                <Clock size={16} />
                <h3 className="text-xs font-bold uppercase tracking-widest">Recent Foods</h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {recentFoodLogs.map((log) => (
                  <button
                    key={log.id}
                    onClick={() => setEstimate({
                      name: log.name,
                      calories: log.calories,
                      protein: log.protein,
                      carbs: log.carbs,
                      fats: log.fats,
                      alcohol: log.alcohol || 0,
                      portion: log.portion,
                      reasoning: 'From your history',
                      category: log.category || 'Breakfast'
                    })}
                    className="flex items-center justify-between p-4 bg-zinc-900 rounded-2xl border border-zinc-800 hover:bg-zinc-800 transition-all text-left"
                  >
                    <div>
                      <h4 className="font-bold text-zinc-100">{log.name}</h4>
                      <p className="text-xs text-zinc-500">{log.portion} • {log.calories} kcal</p>
                    </div>
                    <Plus size={18} className="text-orange-500" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Food Name</label>
              <input 
                type="text" 
                placeholder="e.g. Chicken Breast"
                className="w-full p-4 bg-zinc-900 rounded-2xl border border-zinc-800 focus:ring-2 focus:ring-orange-500 text-zinc-100"
                value={manualFood.name}
                onChange={(e) => setManualFood({ ...manualFood, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Calories</label>
                <input 
                  type="number" 
                  className="w-full p-4 bg-zinc-900 rounded-2xl border border-zinc-800 focus:ring-2 focus:ring-orange-500 text-zinc-100"
                  value={manualFood.calories === 0 ? '' : manualFood.calories}
                  placeholder="0"
                  onChange={(e) => setManualFood({ ...manualFood, calories: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Portion</label>
                <input 
                  type="text" 
                  className="w-full p-4 bg-zinc-900 rounded-2xl border border-zinc-800 focus:ring-2 focus:ring-orange-500 text-zinc-100"
                  value={manualFood.portion}
                  onChange={(e) => setManualFood({ ...manualFood, portion: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Protein (g)</label>
                <input 
                  type="number" 
                  className="w-full p-4 bg-zinc-900 rounded-2xl border border-zinc-800 focus:ring-2 focus:ring-orange-500 text-zinc-100"
                  value={manualFood.protein === 0 ? '' : manualFood.protein}
                  placeholder="0"
                  onChange={(e) => setManualFood({ ...manualFood, protein: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Carbs (g)</label>
                <input 
                  type="number" 
                  className="w-full p-4 bg-zinc-900 rounded-2xl border border-zinc-800 focus:ring-2 focus:ring-orange-500 text-zinc-100"
                  value={manualFood.carbs === 0 ? '' : manualFood.carbs}
                  placeholder="0"
                  onChange={(e) => setManualFood({ ...manualFood, carbs: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Fats (g)</label>
                <input 
                  type="number" 
                  className="w-full p-4 bg-zinc-900 rounded-2xl border border-zinc-800 focus:ring-2 focus:ring-orange-500 text-zinc-100"
                  value={manualFood.fats === 0 ? '' : manualFood.fats}
                  placeholder="0"
                  onChange={(e) => setManualFood({ ...manualFood, fats: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Alcohol (g)</label>
                <input 
                  type="number" 
                  className="w-full p-4 bg-zinc-900 rounded-2xl border border-zinc-800 focus:ring-2 focus:ring-orange-500 text-zinc-100"
                  value={manualFood.alcohol === 0 ? '' : manualFood.alcohol}
                  placeholder="0"
                  onChange={(e) => setManualFood({ ...manualFood, alcohol: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Category</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setManualFood({ ...manualFood, category: cat })}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-tight transition-all ${manualFood.category === cat ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-zinc-300'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-3xl text-center space-y-4">
              <p className="text-red-500 font-bold">{error}</p>
              <button 
                onClick={handleSearch}
                className="px-6 py-2 bg-red-500 text-white rounded-xl font-bold text-sm"
              >
                Retry AI Analysis
              </button>
            </div>
          )}

          <button 
            onClick={handleManualLog}
            disabled={isLogging}
            className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold shadow-lg shadow-orange-500/20 disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {isLogging ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Logging...
              </>
            ) : (
              "Log Manual Entry"
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function HistorySection({ userId, goals }: { userId: string, goals: UserProfile['goals'] }) {
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      const { foodLogs, waterLogs } = await getHistoricalLogs(userId, 7);
      
      const days: any[] = [];
      const now = new Date();
      const currentStart = new Date();
      currentStart.setHours(1, 0, 0, 0);
      if (now < currentStart) currentStart.setDate(currentStart.getDate() - 1);

      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date(currentStart);
        dayStart.setDate(dayStart.getDate() - i);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const dayFood = foodLogs.filter(log => log.timestamp >= dayStart.getTime() && log.timestamp < dayEnd.getTime());
        const dayWater = waterLogs.filter(log => log.timestamp >= dayStart.getTime() && log.timestamp < dayEnd.getTime());

        const calories = dayFood.reduce((sum, log) => sum + log.calories, 0);
        const goal = goals.calories;

        days.push({
          date: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
          calories,
          goal
        });
      }
      setHistoryData(days);
      setLoading(false);
    };

    fetchHistory();
  }, [userId, goals]);

  if (loading) return <div className="h-48 flex items-center justify-center text-zinc-600 text-xs italic">Loading history...</div>;

  return (
    <div className="h-64 w-full bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={historyData}>
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 10 }} />
          <YAxis hide domain={[0, (dataMax: number) => Math.max(dataMax, goals.calories) * 1.2]} />
          <Tooltip 
            cursor={{ fill: 'rgba(255,255,255,0.05)', radius: 8 }}
            contentStyle={{ backgroundColor: '#18181b', borderRadius: '12px', border: '1px solid #27272a', boxShadow: 'none' }}
            labelStyle={{ fontWeight: 'bold', color: '#f4f4f5' }}
            itemStyle={{ color: '#f4f4f5' }}
          />
          <Bar dataKey="calories" radius={[6, 6, 0, 0]} barSize={32}>
            {historyData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.calories > entry.goal ? '#ef4444' : '#f97316'} 
                fillOpacity={entry.calories === 0 ? 0.2 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SettingsView({ profile, onClose, onLogout }: { profile: UserProfile, onClose: () => void, onLogout: () => void }) {
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [isLoggingWeight, setIsLoggingWeight] = useState(false);
  const [isCalculatingTDEE, setIsCalculatingTDEE] = useState(false);
  const [goals, setGoals] = useState(profile.goals);
  const [weight, setWeight] = useState('');

  useEffect(() => {
    if (!isEditingGoals) {
      setGoals(profile.goals);
    }
  }, [profile.goals, isEditingGoals]);

  const updateMacrosFromCalories = (newCals: number) => {
    const pKcal = goals.protein * 4;
    const cKcal = goals.carbs * 4;
    const fKcal = goals.fats * 9;
    const total = pKcal + cKcal + fKcal;

    if (total === 0) {
      // Default split if everything is zero: 30% P, 40% C, 30% F
      setGoals({
        calories: newCals,
        protein: Math.round((newCals * 0.3) / 4),
        carbs: Math.round((newCals * 0.4) / 4),
        fats: Math.round((newCals * 0.3) / 9),
        water: goals.water,
      });
      return;
    }

    setGoals({
      calories: newCals,
      protein: Math.round((newCals * (pKcal / total)) / 4),
      carbs: Math.round((newCals * (cKcal / total)) / 4),
      fats: Math.round((newCals * (fKcal / total)) / 9),
      water: goals.water,
    });
  };

  const updateCaloriesFromMacros = (p: number, c: number, f: number) => {
    setGoals({
      calories: Math.round((p * 4) + (c * 4) + (f * 9)),
      protein: p,
      carbs: c,
      fats: f,
      water: goals.water,
    });
  };

  const handleSaveGoals = async () => {
    await updateGoals(profile.uid, goals);
    setIsEditingGoals(false);
  };

  const handleLogWeight = async () => {
    const wLbs = parseFloat(weight);
    if (!isNaN(wLbs)) {
      const wKg = Math.round((wLbs / 2.20462) * 10) / 10;
      await logWeight(profile.uid, wKg);
      setIsLoggingWeight(false);
      setWeight('');
    }
  };

  const weightHistoryLbs = profile.weightHistory.map(entry => ({
    ...entry,
    weight: Math.round(entry.weight * 2.20462 * 10) / 10
  }));

  if (isCalculatingTDEE) {
    return (
      <div className="fixed inset-0 bg-zinc-950 z-[40] p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-black text-zinc-100 tracking-tight">TDEE Calculator</h2>
          <button onClick={() => setIsCalculatingTDEE(false)} className="p-2 bg-zinc-900 rounded-xl"><X size={20} /></button>
        </div>
        <TDEECalculator profile={profile} onComplete={() => setIsCalculatingTDEE(false)} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-zinc-950 z-30 p-6 overflow-y-auto text-zinc-100">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-black text-zinc-100 tracking-tight">Settings</h2>
        <button onClick={onClose} className="p-2 bg-zinc-900 rounded-xl"><X size={20} /></button>
      </div>

      <div className="space-y-8">
        <section>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Daily Goals</h3>
            {isEditingGoals && (
              <button onClick={handleSaveGoals} className="text-xs font-bold text-orange-500 uppercase">Save</button>
            )}
          </div>
          
          {isEditingGoals ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800">
                <p className="text-xs text-zinc-500 mb-1">Calories</p>
                <input 
                  type="number" 
                  value={goals.calories === 0 ? '' : (goals.calories ?? 0)} 
                  placeholder="0"
                  onChange={(e) => updateMacrosFromCalories(parseInt(e.target.value) || 0)}
                  className="w-full bg-transparent text-xl font-bold text-zinc-100 focus:outline-none"
                />
              </div>
              <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800">
                <p className="text-xs text-zinc-500 mb-1">Protein (g)</p>
                <input 
                  type="number" 
                  value={goals.protein === 0 ? '' : (goals.protein ?? 0)} 
                  placeholder="0"
                  onChange={(e) => updateCaloriesFromMacros(parseInt(e.target.value) || 0, goals.carbs, goals.fats)}
                  className="w-full bg-transparent text-xl font-bold text-zinc-100 focus:outline-none"
                />
              </div>
              <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800">
                <p className="text-xs text-zinc-500 mb-1">Carbs (g)</p>
                <input 
                  type="number" 
                  value={goals.carbs === 0 ? '' : (goals.carbs ?? 0)} 
                  placeholder="0"
                  onChange={(e) => updateCaloriesFromMacros(goals.protein, parseInt(e.target.value) || 0, goals.fats)}
                  className="w-full bg-transparent text-xl font-bold text-zinc-100 focus:outline-none"
                />
              </div>
              <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800">
                <p className="text-xs text-zinc-500 mb-1">Fats (g)</p>
                <input 
                  type="number" 
                  value={goals.fats === 0 ? '' : (goals.fats ?? 0)} 
                  placeholder="0"
                  onChange={(e) => updateCaloriesFromMacros(goals.protein, goals.carbs, parseInt(e.target.value) || 0)}
                  className="w-full bg-transparent text-xl font-bold text-zinc-100 focus:outline-none"
                />
              </div>
              <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800">
                <p className="text-xs text-zinc-500 mb-1">Water (oz)</p>
                <input 
                  type="number" 
                  value={goals.water === 0 ? '' : (goals.water ?? 0)} 
                  placeholder="0"
                  onChange={(e) => setGoals({ ...goals, water: parseInt(e.target.value) || 0 })}
                  className="w-full bg-transparent text-xl font-bold text-zinc-100 focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800">
                <p className="text-xs text-zinc-500 mb-1">Calories</p>
                <p className="text-xl font-bold text-zinc-100">{profile.goals.calories} kcal</p>
              </div>
              <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800">
                <p className="text-xs text-zinc-500 mb-1">Protein</p>
                <p className="text-xl font-bold text-zinc-100">{profile.goals.protein}g</p>
              </div>
              <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800">
                <p className="text-xs text-zinc-500 mb-1">Carbs</p>
                <p className="text-xl font-bold text-zinc-100">{profile.goals.carbs}g</p>
              </div>
              <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800">
                <p className="text-xs text-zinc-500 mb-1">Fats</p>
                <p className="text-xl font-bold text-zinc-100">{profile.goals.fats}g</p>
              </div>
              <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800">
                <p className="text-xs text-zinc-500 mb-1">Water</p>
                <p className="text-xl font-bold text-zinc-100">{profile.goals.water}oz</p>
              </div>
            </div>
          )}
          
          {!isEditingGoals && (
            <div className="flex gap-2 mt-4">
              <button 
                onClick={() => setIsEditingGoals(true)}
                className="flex-1 py-3 text-orange-500 font-bold text-sm bg-orange-500/10 rounded-xl"
              >
                Manual Adjust
              </button>
              <button 
                onClick={() => setIsCalculatingTDEE(true)}
                className="flex-1 py-3 text-zinc-400 font-bold text-sm bg-zinc-900 rounded-xl border border-zinc-800"
              >
                Recalculate TDEE
              </button>
            </div>
          )}
        </section>

        <section>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">7-Day History</h3>
          <HistorySection userId={profile.uid} goals={profile.goals} />
        </section>

        <section>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Weight Progress</h3>
          <div className="h-48 w-full bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
            {weightHistoryLbs.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightHistoryLbs}>
                  <XAxis dataKey="date" hide />
                  <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                  <Tooltip 
                    formatter={(value: number) => [`${value} lbs`, 'Weight']}
                    contentStyle={{ backgroundColor: '#18181b', borderRadius: '12px', border: '1px solid #27272a', boxShadow: 'none' }}
                    labelStyle={{ fontWeight: 'bold', color: '#f4f4f5' }}
                    itemStyle={{ color: '#f4f4f5' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="weight" 
                    stroke="#f97316" 
                    strokeWidth={3} 
                    dot={{ fill: '#f97316', r: 4 }} 
                    activeDot={{ r: 6, stroke: '#121212', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-600 text-xs italic">
                No weight data logged yet.
              </div>
            )}
          </div>
          
          {isLoggingWeight ? (
            <div className="mt-4 flex gap-2">
              <input 
                type="number" 
                step="0.1"
                placeholder="Weight (lbs)"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="flex-1 p-3 bg-zinc-900 rounded-xl border border-zinc-800 focus:ring-2 focus:ring-orange-500 text-zinc-100"
              />
              <button 
                onClick={handleLogWeight}
                className="px-6 py-3 bg-orange-500 text-white font-bold rounded-xl"
              >
                Log
              </button>
              <button 
                onClick={() => setIsLoggingWeight(false)}
                className="px-4 py-3 bg-zinc-800 text-zinc-400 font-bold rounded-xl"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsLoggingWeight(true)}
              className="w-full mt-4 py-3 text-orange-500 font-bold text-sm bg-orange-500/10 rounded-xl"
            >
              Log Weight
            </button>
          )}
        </section>

        <section>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">System Status</h3>
          <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${process.env.GEMINI_API_KEY ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
              <span className="text-sm font-medium text-zinc-300">AI Search Engine</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-tighter text-zinc-500">
              {process.env.GEMINI_API_KEY ? 'Connected' : 'Key Missing'}
            </span>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Account</h3>
          <div className="flex items-center gap-4 p-4 bg-zinc-900 rounded-2xl border border-zinc-800 mb-4">
            <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 font-bold">
              {profile.displayName[0]}
            </div>
            <div>
              <p className="font-bold text-zinc-100">{profile.displayName}</p>
              <p className="text-xs text-zinc-500">{profile.email}</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full py-4 bg-red-500/10 text-red-500 rounded-2xl font-bold flex items-center justify-center gap-2"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </section>
      </div>
    </div>
  );
}
