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
  
  const prompt = `You are a Professional Nutrition Coach and Dietitian. 
  Analyze this food or drink item with expert precision.
  ${text ? `Description: ${text}` : ""}
  ${image ? "An image of the item is provided." : ""}
  
  Provide a structured nutritional estimate including calories, protein, carbs, fats, and alcohol (in grams).
  
  CRITICAL INSTRUCTIONS:
  1. PERSONA: Act as a supportive but firm nutrition coach.
  2. SEARCH: Use Google Search to verify nutritional data for specific brands, restaurant menu items, or unique food types mentioned.
  3. CHAIN OF THOUGHT: In the 'reasoning' field, first break down the components of the meal/drink, then provide actionable coaching advice (e.g., "Great protein choice, but watch the sodium in this brand").
  4. ALCOHOL: For alcoholic drinks, you MUST calculate the alcohol content in grams (7 kcal/g).
  5. CALORIE CALCULATION RULE: The "calories" field MUST be exactly: (protein * 4) + (carbs * 4) + (fats * 9) + (alcohol * 7).
  6. PORTIONS: Be precise about portion sizes. If a specific quantity is mentioned (e.g., "12oz", "pint"), use it.
  
  Return the data as a JSON object.`;

  const parts: any[] = [{ text: prompt }];
  if (image) {
    parts.push({ inlineData: image });
  }

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
    config: {
      tools: [{ googleSearch: {} }],
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
          reasoning: { type: Type.STRING, description: "Breakdown of components followed by actionable coaching advice." }
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
