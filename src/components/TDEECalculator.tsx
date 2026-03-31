import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { UserProfile } from '../types';
import { updateUserProfile } from '../firebase';
import { Check, ChevronRight, ChevronLeft, Info } from 'lucide-react';

interface TDEECalculatorProps {
  profile: UserProfile;
  onComplete?: () => void;
  isInitialSetup?: boolean;
}

const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Sedentary', desc: 'Little to no exercise', multiplier: 1.2 },
  { id: 'lightlyActive', label: 'Lightly Active', desc: 'Exercise 1-3 times/week', multiplier: 1.375 },
  { id: 'moderatelyActive', label: 'Moderately Active', desc: 'Exercise 4-5 times/week', multiplier: 1.55 },
  { id: 'veryActive', label: 'Very Active', desc: 'Daily exercise or intense exercise 3-4 times/week', multiplier: 1.725 },
  { id: 'extraActive', label: 'Extra Active', desc: 'Very intense exercise daily, or physical job', multiplier: 1.9 },
];

export default function TDEECalculator({ profile, onComplete, isInitialSetup = false }: TDEECalculatorProps) {
  const [step, setStep] = useState(1);
  
  // Convert existing metric data to imperial for the UI
  const initialWeightKg = profile.weightHistory.length > 0 
    ? profile.weightHistory[profile.weightHistory.length - 1].weight 
    : 70;
  const initialHeightCm = profile.height || 170;
  
  const [formData, setFormData] = useState({
    age: profile.age || 25,
    gender: profile.gender || 'male',
    heightFeet: Math.floor(initialHeightCm / 30.48),
    heightInches: Math.round((initialHeightCm % 30.48) / 2.54),
    weightLbs: Math.round(initialWeightKg * 2.20462),
    activityLevel: profile.activityLevel || 'sedentary',
    goalType: 'maintenance' as 'deficit' | 'maintenance' | 'surplus',
    goalAmount: 500,
    macroSplit: {
      protein: 30,
      carbs: 40,
      fats: 30
    }
  });

  const [maintenanceTDEE, setMaintenanceTDEE] = useState(0);
  const [targetCalories, setTargetCalories] = useState(0);

  useEffect(() => {
    // Convert imperial to metric for calculation
    const heightCm = (formData.heightFeet * 30.48) + (formData.heightInches * 2.54);
    const weightKg = formData.weightLbs / 2.20462;

    // Mifflin-St Jeor Equation
    let bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * formData.age);
    if (formData.gender === 'male') {
      bmr += 5;
    } else if (formData.gender === 'female') {
      bmr -= 161;
    } else {
      bmr -= 78;
    }

    const level = ACTIVITY_LEVELS.find(l => l.id === formData.activityLevel);
    const multiplier = level ? level.multiplier : 1.2;
    const tdee = Math.round(bmr * multiplier);
    setMaintenanceTDEE(tdee);

    let target = tdee;
    if (formData.goalType === 'deficit') target -= formData.goalAmount;
    if (formData.goalType === 'surplus') target += formData.goalAmount;
    setTargetCalories(Math.max(1200, target)); // Minimum safe calories
  }, [formData]);

  const handleSave = async () => {
    const heightCm = (formData.heightFeet * 30.48) + (formData.heightInches * 2.54);
    const weightKg = Math.round((formData.weightLbs / 2.20462) * 10) / 10;

    const goals = {
      ...profile.goals,
      calories: targetCalories,
      protein: Math.round((targetCalories * (formData.macroSplit.protein / 100)) / 4),
      carbs: Math.round((targetCalories * (formData.macroSplit.carbs / 100)) / 4),
      fats: Math.round((targetCalories * (formData.macroSplit.fats / 100)) / 9),
    };

    await updateUserProfile(profile.uid, {
      age: formData.age,
      gender: formData.gender,
      height: heightCm,
      activityLevel: formData.activityLevel,
      goals,
      isSetupComplete: true,
      weightHistory: profile.weightHistory.length === 0 || Math.abs(profile.weightHistory[profile.weightHistory.length - 1].weight - weightKg) > 0.1
        ? [...profile.weightHistory, { date: new Date().toISOString().split('T')[0], weight: weightKg }].slice(-30)
        : profile.weightHistory
    });

    if (onComplete) onComplete();
  };

  const updateMacro = (key: keyof typeof formData.macroSplit, value: number) => {
    const otherKeys = Object.keys(formData.macroSplit).filter(k => k !== key) as (keyof typeof formData.macroSplit)[];
    const remaining = 100 - value;
    const currentOtherSum = formData.macroSplit[otherKeys[0]] + formData.macroSplit[otherKeys[1]];
    
    let newSplit = { ...formData.macroSplit, [key]: value };
    
    if (currentOtherSum > 0) {
      newSplit[otherKeys[0]] = Math.round((formData.macroSplit[otherKeys[0]] / currentOtherSum) * remaining);
      newSplit[otherKeys[1]] = 100 - value - newSplit[otherKeys[0]];
    } else {
      newSplit[otherKeys[0]] = Math.round(remaining / 2);
      newSplit[otherKeys[1]] = remaining - newSplit[otherKeys[0]];
    }

    setFormData({ ...formData, macroSplit: newSplit });
  };

  return (
    <div className={`flex flex-col h-full ${isInitialSetup ? 'bg-zinc-950 p-6' : ''}`}>
      {isInitialSetup && (
        <div className="mb-8">
          <h2 className="text-3xl font-black text-zinc-100 tracking-tight mb-2">Welcome!</h2>
          <p className="text-zinc-500">Let's calculate your daily energy needs to get started.</p>
        </div>
      )}

      <div className="flex-1 space-y-8">
        {step === 1 && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <h3 className="text-xl font-bold text-zinc-100">Basic Info</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Gender</label>
                <div className="flex gap-2 p-1 bg-zinc-900 rounded-2xl border border-zinc-800">
                  {['male', 'female', 'other'].map(g => (
                    <button
                      key={g}
                      onClick={() => setFormData({ ...formData, gender: g as any })}
                      className={`flex-1 py-3 rounded-xl font-bold text-sm capitalize transition-all ${formData.gender === g ? 'bg-orange-500 text-white shadow-lg' : 'text-zinc-500'}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div>
                  <label className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block truncate">Age</label>
                  <input 
                    type="number"
                    value={formData.age === 0 ? '' : formData.age}
                    placeholder="0"
                    onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) || 0 })}
                    className="w-full p-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-zinc-100 font-bold focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block truncate">Height (ft)</label>
                  <input 
                    type="number"
                    value={formData.heightFeet === 0 ? '' : formData.heightFeet}
                    placeholder="0"
                    onChange={(e) => setFormData({ ...formData, heightFeet: parseInt(e.target.value) || 0 })}
                    className="w-full p-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-zinc-100 font-bold focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block truncate">(in)</label>
                  <input 
                    type="number"
                    value={formData.heightInches === 0 ? '' : formData.heightInches}
                    placeholder="0"
                    onChange={(e) => setFormData({ ...formData, heightInches: parseInt(e.target.value) || 0 })}
                    className="w-full p-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-zinc-100 font-bold focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Weight (lbs)</label>
                <input 
                  type="number"
                  step="1"
                  value={formData.weightLbs === 0 ? '' : formData.weightLbs}
                  placeholder="0"
                  onChange={(e) => setFormData({ ...formData, weightLbs: parseFloat(e.target.value) || 0 })}
                  className="w-full p-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-zinc-100 font-bold focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <h3 className="text-xl font-bold text-zinc-100">Activity Level</h3>
            <div className="space-y-3">
              {ACTIVITY_LEVELS.map(level => (
                <button
                  key={level.id}
                  onClick={() => setFormData({ ...formData, activityLevel: level.id as any })}
                  className={`w-full p-4 rounded-2xl border text-left transition-all ${formData.activityLevel === level.id ? 'bg-orange-500 border-orange-400 shadow-lg' : 'bg-zinc-900 border-zinc-800'}`}
                >
                  <p className={`font-bold ${formData.activityLevel === level.id ? 'text-white' : 'text-zinc-100'}`}>{level.label}</p>
                  <p className={`text-xs ${formData.activityLevel === level.id ? 'text-orange-100' : 'text-zinc-500'}`}>{level.desc}</p>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <div className="text-center mb-4">
              <h3 className="text-xl font-bold text-zinc-100 mb-2">Set Your Goal</h3>
              <p className="text-zinc-500 text-sm">Maintenance: {maintenanceTDEE} kcal</p>
            </div>

            <div className="flex gap-2 p-1 bg-zinc-900 rounded-2xl border border-zinc-800 mb-6">
              {(['deficit', 'maintenance', 'surplus'] as const).map(g => (
                <button
                  key={g}
                  onClick={() => setFormData({ ...formData, goalType: g })}
                  className={`flex-1 py-3 rounded-xl font-bold text-xs capitalize transition-all ${formData.goalType === g ? 'bg-orange-500 text-white shadow-lg' : 'text-zinc-500'}`}
                >
                  {g}
                </button>
              ))}
            </div>

            {formData.goalType !== 'maintenance' && (
              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Adjustment Amount</label>
                  <span className="text-orange-500 font-bold">{formData.goalAmount} kcal</span>
                </div>
                <input 
                  type="range"
                  min="100"
                  max="1000"
                  step="50"
                  value={formData.goalAmount}
                  onChange={(e) => setFormData({ ...formData, goalAmount: parseInt(e.target.value) })}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
              </div>
            )}

            <div className="p-6 bg-zinc-900 rounded-3xl border border-zinc-800 flex flex-col items-center justify-center mb-8">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Target Calories</span>
              <span className="text-5xl font-black text-zinc-100">{targetCalories}</span>
              <span className="text-xs font-bold text-orange-500 uppercase tracking-widest mt-1">kcal / day</span>
            </div>

            <div className="space-y-6">
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Macro Split</h4>
              
              <div className="space-y-4">
                {([['protein', 'Protein', 4], ['carbs', 'Carbs', 4], ['fats', 'Fats', 9]] as const).map(([key, label, divisor]) => (
                  <div key={key} className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-zinc-400">{label}</span>
                      <div className="flex gap-2">
                        <span className="text-orange-500">{Math.round((targetCalories * (formData.macroSplit[key] / 100)) / divisor)}g</span>
                        <span className="text-zinc-500">/</span>
                        <span className="text-zinc-100">{formData.macroSplit[key]}%</span>
                      </div>
                    </div>
                    <input 
                      type="range"
                      min="10"
                      max="80"
                      step="5"
                      value={formData.macroSplit[key]}
                      onChange={(e) => updateMacro(key, parseInt(e.target.value))}
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-8 flex flex-col items-center justify-center py-8"
          >
            <div className="text-center">
              <h3 className="text-xl font-bold text-zinc-100 mb-2">Summary</h3>
              <p className="text-zinc-500 text-sm">Your personalized daily targets are ready.</p>
            </div>

            <div className="relative">
              <div className="w-48 h-48 rounded-full border-8 border-orange-500/20 flex flex-col items-center justify-center bg-orange-500/5 shadow-[0_0_50px_rgba(249,115,22,0.1)]">
                <span className="text-4xl font-black text-zinc-100">{targetCalories}</span>
                <span className="text-xs font-bold text-orange-500 uppercase tracking-widest">kcal / day</span>
              </div>
              <motion.div 
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -top-2 -right-2 p-3 bg-orange-500 text-white rounded-2xl shadow-lg"
              >
                <Check size={24} />
              </motion.div>
            </div>

            <div className="grid grid-cols-3 gap-4 w-full">
              <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-center">
                <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Protein</p>
                <p className="text-lg font-black text-zinc-100">{Math.round((targetCalories * (formData.macroSplit.protein / 100)) / 4)}g</p>
              </div>
              <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-center">
                <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Carbs</p>
                <p className="text-lg font-black text-zinc-100">{Math.round((targetCalories * (formData.macroSplit.carbs / 100)) / 4)}g</p>
              </div>
              <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-center">
                <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Fats</p>
                <p className="text-lg font-black text-zinc-100">{Math.round((targetCalories * (formData.macroSplit.fats / 100)) / 9)}g</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800/50">
              <Info size={16} className="text-zinc-500 mt-0.5 shrink-0" />
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                You've selected a {formData.goalType} plan. You can always adjust these targets manually in settings if your goals change.
              </p>
            </div>
          </motion.div>
        )}
      </div>

      <div className="flex gap-3 mt-8">
        {step > 1 && (
          <button 
            onClick={() => setStep(step - 1)}
            className="p-4 bg-zinc-900 text-zinc-400 rounded-2xl border border-zinc-800"
          >
            <ChevronLeft size={24} />
          </button>
        )}
        <button 
          onClick={() => step < 4 ? setStep(step + 1) : handleSave()}
          className="flex-1 py-4 bg-zinc-100 text-zinc-950 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2"
        >
          {step < 4 ? (
            <>
              Next Step
              <ChevronRight size={20} />
            </>
          ) : (
            <>
              Apply Targets
              <Check size={20} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
