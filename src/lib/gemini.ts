import { GoogleGenAI, Type } from "@google/genai";
import { NutritionEstimate } from "../types";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '' 
});

export async function estimateNutrition(text?: string, image?: { data: string; mimeType: string }): Promise<NutritionEstimate> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini API key is not configured. Please check your environment variables.");
  }
  
  const model = "gemini-3-flash-preview";
  
  const prompt = `Analyze this food or drink item. 
  ${text ? `Description: ${text}` : ""}
  ${image ? "An image of the item is provided." : ""}
  
  Provide a structured nutritional estimate including calories, protein, carbs, fats, and alcohol (in grams).
  
  CRITICAL INSTRUCTIONS:
  1. Handle both food and beverages (including alcoholic drinks like beer, wine, spirits).
  2. For alcoholic drinks, you MUST calculate the alcohol content in grams.
  3. CALORIE CALCULATION RULE: The "calories" field MUST be the sum of:
     - (protein * 4)
     - (carbs * 4)
     - (fats * 9)
     - (alcohol * 7)
  4. Alcohol contains 7 kcal per gram. This is a common point of error—do NOT ignore it.
  5. Be realistic about portion sizes. If the description specifies a quantity (e.g., "12oz bottle", "pint", "glass"), use that exactly.
  6. If the item is a specific brand or type (e.g., "IPA beer", "Light beer", "Red wine"), use nutritional data specific to that category.
  
  Return the data as a JSON object.`;

  const parts: any[] = [{ text: prompt }];
  if (image) {
    parts.push({ inlineData: image });
  }

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          calories: { type: Type.NUMBER },
          protein: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
          fats: { type: Type.NUMBER },
          alcohol: { type: Type.NUMBER, description: "Alcohol content in grams" },
          portion: { type: Type.STRING },
          reasoning: { type: Type.STRING }
        },
        required: ["name", "calories", "protein", "carbs", "fats", "alcohol", "portion", "reasoning"]
      }
    }
  });

  const data = JSON.parse(response.text);
  return {
    ...data,
    name: (data.name || "Unknown Food").substring(0, 150),
    portion: (data.portion || "1 serving").substring(0, 100),
    calories: Number(data.calories) || 0,
    protein: Number(data.protein) || 0,
    carbs: Number(data.carbs) || 0,
    fats: Number(data.fats) || 0,
    alcohol: Number(data.alcohol) || 0,
    reasoning: (data.reasoning || "").substring(0, 500),
  };
}
