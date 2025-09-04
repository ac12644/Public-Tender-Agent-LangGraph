import { db } from "./firestore";

export type LLMConfig = {
  provider?: "gemini" | "openai" | "openrouter";
  // Gemini
  GOOGLE_GENAI_API_KEY?: string;
  GEMINI_MODEL?: string;
  // OpenAI
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  // OpenRouter
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
};

let cache: { at: number; data: LLMConfig } | null = null;
const TTL_MS = 60_000; // 1 minute cache

export async function getRuntimeLLMConfig(): Promise<LLMConfig> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.data;

  const snap = await db.doc("config/runtime/llm/current").get();
  const data = (snap.exists ? (snap.data() as LLMConfig) : {}) ?? {};
  cache = { at: now, data };
  return data;
}
