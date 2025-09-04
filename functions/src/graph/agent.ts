import {
  START,
  StateGraph,
  MessagesAnnotation,
  MemorySaver,
} from "@langchain/langgraph";
import { createReactAgent, withAgentName } from "@langchain/langgraph/prebuilt";
import type { LanguageModelLike } from "@langchain/core/language_models/base";

import { llmFactory } from "../lib/llm";
import {
  searchTendersTool,
  saveTenderSummaryTool,
  saveMatchScoreTool,
  buildTedExpertQueryTool,
  currentDateTool,
} from "./tools";

/**
 * LLM provider (async allowed). If Gemini, wrap to inline agent name
 * so traces are easier to inspect (no behavior change).
 */
const llmProvider = async (): Promise<LanguageModelLike> => {
  const base = await llmFactory();
  try {
    if (
      typeof (base as any).getName === "function" &&
      (base as any).getName() === "ChatGoogleGenerativeAI"
    ) {
      return withAgentName(base, "inline");
    }
  } catch {
    /* noop */
  }
  return base;
};

const tools = [
  buildTedExpertQueryTool, // 🧭 build structured TED Expert Query
  searchTendersTool, // 🔎 call TED search
  saveTenderSummaryTool, // 📝 persist summaries
  saveMatchScoreTool, // 📈 persist match scores
  currentDateTool, // 📅 canonical server date helper
];

/**
 * Keep prompt declarative and tool-driven.
 * We do NOT hardcode dates; `index.ts` injects Firestore date as SYSTEM,
 * and a `get_current_date` tool is also available when needed.
 */
export const agent = createReactAgent({
  llm: llmProvider,
  tools,
  name: "tender_agent",
  prompt: [
    "You assist with EU/Italian public procurement (TED v3).",
    "If the user asks for tenders in natural language:",
    "  1) Call build_ted_query to construct a valid Expert Query.",
    "  2) Call search_tenders with the returned query.",
    "Default country = ITA unless the user asks otherwise.",
    "When building rows:",
    " - NoticeId = `notice-identifier` if present, else `publication-number`.",
    " - Value = best available among `estimated-value-glo`, `total-value`, or lot result value, formatted like '€ 1 234 567'.",
    " - Pdf = take the *Italian* PDF URL from `links.pdf` (language key 'it' or 'ita'); if missing, fallback to English ('en' or 'eng'); if none, put '—'. Do NOT fabricate URLs.",
    " - Description = write a concise 1–2 sentence summary in Italian (max 140 chars). Prefer information returned by tools (e.g., `description_proposed_it`) when present; otherwise summarise title/buyer/context in Italian.",
    "Use date windows like `today(-N)`..`today()`; avoid absolute dates unless user asks.",
    "If you save a summary, keep it concise in Italian; include a brief English line prefixed with `EN:`.",
    "Finally, always return a concise human summary plus a compact markdown table.",
    "Include the following columns exactly in this order (use '—' if a value is unknown):",
    "| PubNo | NoticeId | Buyer | Title | Published | Deadline | CPV | Value | Pdf | Description |",
    "Never wrap tool arguments in code fences. Only pass fields defined by the tool schema.",
  ].join("\n"),
});

/**
 * Single-node graph with short-term memory to maintain history across turns
 * and avoid 'coercion' issues. Thread id is supplied at call time.
 */
const checkpointer = new MemorySaver();
export const app = new StateGraph(MessagesAnnotation)
  .addNode("agent", agent)
  .addEdge(START, "agent")
  .compile({ name: "tender_graph", checkpointer });
