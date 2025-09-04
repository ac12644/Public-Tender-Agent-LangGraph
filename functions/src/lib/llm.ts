import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { getRuntimeLLMConfig } from "./runtimeConfig";
import type { LanguageModelLike } from "@langchain/core/language_models/base";
import { defineSecret } from "firebase-functions/params";

export const GOOGLE_GENAI_API_KEY = defineSecret("GOOGLE_GENAI_API_KEY");
export const OPENROUTER_API_KEY = defineSecret("OPENROUTER_API_KEY");

/** Returns a ready chat model. Always await this. */
export async function llmFactory(): Promise<LanguageModelLike> {
  if (GOOGLE_GENAI_API_KEY.value()) {
    return new ChatGoogleGenerativeAI({
      model: "gemini-1.5-pro",
      apiKey: GOOGLE_GENAI_API_KEY.value(),
    });
  }

  if (OPENROUTER_API_KEY.value()) {
    return new ChatOpenAI({
      apiKey: OPENROUTER_API_KEY.value(),
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
      },
      modelName: "openrouter/auto",
    });
  }

  // Fallback to Firestore runtime config (if no secrets set)
  const cfg = await getRuntimeLLMConfig();

  if (cfg.provider === "gemini" && cfg.GOOGLE_GENAI_API_KEY) {
    return new ChatGoogleGenerativeAI({
      model: "gemini-1.5-pro",
      apiKey: cfg.GOOGLE_GENAI_API_KEY,
    });
  }

  if (cfg.provider === "openrouter" && cfg.OPENROUTER_API_KEY) {
    return new ChatOpenAI({
      apiKey: cfg.OPENROUTER_API_KEY,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
      },
      modelName: "openrouter/auto",
    });
  }

  throw new Error(
    "No LLM credentials found. Configure Firebase secrets or Firestore runtime config."
  );
}
