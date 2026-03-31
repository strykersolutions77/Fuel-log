export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  height?: number; // in cm
  activityLevel?: 'sedentary' | 'lightlyActive' | 'moderatelyActive' | 'veryActive' | 'extraActive';
  isSetupComplete?: boolean;
  goals: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    water: number; // in oz
  };
  weightHistory: {
    date: string;
    weight: number;
  }[];
}

export interface FoodLog {
  id: string;
  userId: string;
  timestamp: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  alcohol?: number;
  portion: string;
  imageUrl?: string;
}

export interface WaterLog {
  id: string;
  userId: string;
  timestamp: number;
  amount: number; // in oz
}

export interface NutritionEstimate {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  alcohol?: number;
  portion: string;
  reasoning: string;
}
