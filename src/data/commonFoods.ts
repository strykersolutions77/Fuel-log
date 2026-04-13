import { NutritionEstimate } from '../types';

export const COMMON_FOODS: NutritionEstimate[] = [
  // Proteins
  { name: "Chicken Breast", calories: 165, protein: 31, carbs: 0, fats: 3.6, alcohol: 0, portion: "100g (cooked)", reasoning: "Lean protein staple. High in B6 and niacin." },
  { name: "Egg (Large)", calories: 70, protein: 6, carbs: 0.6, fats: 5, alcohol: 0, portion: "1 large egg", reasoning: "Complete protein source with healthy fats and choline." },
  { name: "Salmon", calories: 208, protein: 20, carbs: 0, fats: 13, alcohol: 0, portion: "100g", reasoning: "Excellent source of Omega-3 fatty acids and high-quality protein." },
  { name: "Greek Yogurt (Non-fat)", calories: 59, protein: 10, carbs: 3.6, fats: 0.4, alcohol: 0, portion: "100g", reasoning: "High protein, low calorie dairy option. Great for gut health." },
  { name: "Ground Beef (90% Lean)", calories: 176, protein: 20, carbs: 0, fats: 10, alcohol: 0, portion: "100g", reasoning: "Good source of iron, zinc, and B12." },
  { name: "Tofu (Firm)", calories: 83, protein: 8, carbs: 2, fats: 5, alcohol: 0, portion: "100g", reasoning: "Versatile plant-based protein with all essential amino acids." },
  { name: "Whey Protein Powder", calories: 120, protein: 24, carbs: 3, fats: 1.5, alcohol: 0, portion: "1 scoop (30g)", reasoning: "Fast-digesting protein ideal for post-workout recovery." },
  
  // Carbs
  { name: "White Rice (Cooked)", calories: 130, protein: 2.7, carbs: 28, fats: 0.3, alcohol: 0, portion: "100g", reasoning: "Easily digestible carbohydrate source." },
  { name: "Brown Rice (Cooked)", calories: 111, protein: 2.6, carbs: 23, fats: 0.9, alcohol: 0, portion: "100g", reasoning: "Whole grain with more fiber and magnesium than white rice." },
  { name: "Oatmeal (Cooked)", calories: 71, protein: 2.5, carbs: 12, fats: 1.4, alcohol: 0, portion: "100g", reasoning: "High in beta-glucan fiber, great for heart health and satiety." },
  { name: "Sweet Potato", calories: 86, protein: 1.6, carbs: 20, fats: 0.1, alcohol: 0, portion: "100g", reasoning: "Rich in Vitamin A (beta-carotene) and complex carbs." },
  { name: "Quinoa (Cooked)", calories: 120, protein: 4.4, carbs: 21, fats: 1.9, alcohol: 0, portion: "100g", reasoning: "A rare plant source of complete protein and high fiber." },
  { name: "Banana", calories: 89, protein: 1.1, carbs: 23, fats: 0.3, alcohol: 0, portion: "100g", reasoning: "Good source of potassium and quick energy." },
  { name: "Apple", calories: 52, protein: 0.3, carbs: 14, fats: 0.2, alcohol: 0, portion: "100g", reasoning: "High in pectin fiber and Vitamin C." },
  { name: "Blueberries", calories: 57, protein: 0.7, carbs: 14, fats: 0.3, alcohol: 0, portion: "100g", reasoning: "Antioxidant powerhouse with low glycemic impact." },
  
  // Fats
  { name: "Avocado", calories: 160, protein: 2, carbs: 8.5, fats: 15, alcohol: 0, portion: "100g", reasoning: "Rich in monounsaturated fats and potassium." },
  { name: "Almonds", calories: 579, protein: 21, carbs: 22, fats: 50, alcohol: 0, portion: "100g", reasoning: "High in Vitamin E, magnesium, and healthy fats." },
  { name: "Olive Oil", calories: 884, protein: 0, carbs: 0, fats: 100, alcohol: 0, portion: "100ml", reasoning: "Heart-healthy monounsaturated fats. Use sparingly." },
  { name: "Peanut Butter", calories: 588, protein: 25, carbs: 20, fats: 50, alcohol: 0, portion: "100g", reasoning: "Energy-dense source of protein and healthy fats." },
  
  // Vegetables
  { name: "Broccoli", calories: 34, protein: 2.8, carbs: 7, fats: 0.4, alcohol: 0, portion: "100g", reasoning: "Nutrient-dense cruciferous vegetable high in Vitamin K and C." },
  { name: "Spinach", calories: 23, protein: 2.9, carbs: 3.6, fats: 0.4, alcohol: 0, portion: "100g", reasoning: "Rich in iron, calcium, and folic acid." },
  { name: "Asparagus", calories: 20, protein: 2.2, carbs: 3.9, fats: 0.1, alcohol: 0, portion: "100g", reasoning: "Low calorie, high in folate and Vitamin K." },
  
  // Common Meals
  { name: "Protein Shake (Water)", calories: 120, protein: 24, carbs: 3, fats: 1.5, alcohol: 0, portion: "1 serving", reasoning: "Standard post-workout nutrition." },
  { name: "Black Coffee", calories: 2, protein: 0.3, carbs: 0, fats: 0, alcohol: 0, portion: "1 cup", reasoning: "Virtually calorie-free. Contains antioxidants and caffeine." },
  { name: "Green Tea", calories: 1, protein: 0, carbs: 0, fats: 0, alcohol: 0, portion: "1 cup", reasoning: "Rich in EGCG antioxidants. Zero calories if unsweetened." },
];
