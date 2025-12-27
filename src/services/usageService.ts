import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getClientFirestore } from "@/lib/firebase";

// Pricing Constants (Gemini 1.5 Flash - adjust as needed)
// Input: $0.075 per 1M tokens
// Output: $0.30 per 1M tokens
const PRICING = {
  INPUT_RATE: 0.075 / 1_000_000,
  OUTPUT_RATE: 0.30 / 1_000_000,
};

export interface AiUsageLogParams {
  userId: string;
  cvId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  type: "cv_scan" | "cv_parse" | "chat" | "other";
}

export async function logAiUsage({
  userId,
  cvId,
  model,
  inputTokens,
  outputTokens,
  type,
}: AiUsageLogParams) {
  try {
    const db = getClientFirestore();
    
    const cost = (inputTokens * PRICING.INPUT_RATE) + (outputTokens * PRICING.OUTPUT_RATE);
    const totalCost = Number(cost.toFixed(9)); // Store with high precision

    await addDoc(collection(db, "ai_usage_logs"), {
      userId,
      cvId,
      model,
      inputTokens,
      outputTokens,
      totalCost,
      timestamp: serverTimestamp(),
      type,
    });
    
    console.log(`[AI Usage] Logged: $${totalCost} (${inputTokens}in/${outputTokens}out) for ${cvId}`);
  } catch (error) {
    console.error("Failed to log AI usage:", error);
    // Don't block the main flow if logging fails
  }
}
