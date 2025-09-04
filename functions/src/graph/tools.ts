import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { serverTimestamp, db } from "../lib/firestore";
import { safeTool } from "./tooling";
import { tedSearch } from "../lib/ted";
import { saveTenderSummary, saveMatchScore } from "../lib/firestore";
import type { TenderDoc } from "../lib/types";

/* -------------------- Shared Types -------------------- */
export type TenderLite = {
  publicationNumber: string;
  title: string;
  buyer: string;
  publicationDate?: string;
  deadline?: string;
  cpv?: string | string[] | null;
  nuts?: string | null;
  links?: TenderDoc["links"];
  summary_it?: string | null;
  summary_en?: string | null;
};

/* -------------------- build_ted_query -------------------- */
const QueryIntent = z.object({
  country: z.string().default("ITA"),
  daysBack: z.number().int().min(0).max(30).default(3),
  cpv: z.array(z.string()).optional(), // e.g. ["90911200"]
  text: z.string().optional(), // free keywords
});

export const buildTedExpertQueryTool = safeTool({
  name: "build_ted_query",
  description:
    "Build a valid TED Expert Query string from a structured intent.",
  schema: QueryIntent,
  fn: async ({ country, daysBack, cpv, text }) => {
    const date = (d: number) => `today(${d === 0 ? "" : `-${d}`})`;
    const parts = [
      `(place-of-performance IN (${country}))`,
      `(publication-date >= ${date(daysBack)} AND publication-date <= today())`,
    ];
    if (cpv?.length) {
      parts.push(
        `(${cpv.map((c) => `classification-cpv = "${c}"`).join(" OR ")})`
      );
    }
    if (text && text.trim()) {
      parts.push(
        `(title ~ "${text.trim()}" OR description-proc ~ "${text.trim()}")`
      );
    }
    return parts.join(" AND ");
  },
});

/* -------------------- search_tenders -------------------- */
const SearchTendersInput = z.object({
  q: z.string().min(1),
  limit: z.number().int().min(1).max(50).default(10),
});

function firstString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.find((x) => typeof x === "string");
  return undefined;
}

function pickPdfItaOrEn(links: any): string | undefined {
  const pdf = links?.pdf;
  if (!pdf || typeof pdf !== "object") return undefined;
  const keys = Object.keys(pdf);

  // prefer Italian ('it' or 'ita'), then English ('en' or 'eng'), case-insensitive
  const find = (tags: string[]) =>
    keys.find((k) => {
      const low = k.toLowerCase();
      return tags.some((t) => low === t || low.startsWith(t));
    });

  const itKey = find(["it", "ita"]);
  const enKey = find(["en", "eng"]);

  const val = firstString(itKey ? pdf[itKey] : enKey ? pdf[enKey] : undefined);
  return val;
}

export const searchTendersTool = safeTool({
  name: "search_tenders",
  description:
    "Search TED notices using Expert Query. Returns an array of tenders.",
  schema: SearchTendersInput,
  fn: async ({ q, limit }) => {
    const notices = await tedSearch({ q, limit });

    console.log("🔎 Raw notice sample:", JSON.stringify(notices[0], null, 2));
    console.log("🔑 Keys in notice:", Object.keys(notices[0] || {}));

    return notices.map((n: any) => {
      // description candidates (for the agent to summarise in Italian)
      const desc_it =
        n["description-proc"]?.ita ?? n["description-glo"]?.ita ?? null;

      const desc_en =
        n["description-proc"]?.eng ??
        n["description-proc"]?.en ??
        n["description-glo"]?.eng ??
        n["description-glo"]?.en ??
        null;

      const pdfItaOrEn = pickPdfItaOrEn(n.links);

      return {
        publicationNumber: String(n["publication-number"] ?? ""),
        noticeId: n["notice-identifier"] ?? n["publication-number"] ?? "",
        title:
          n["notice-title"]?.ita ??
          n["notice-title"]?.eng ??
          n["notice-title"]?.en ??
          "",
        buyer:
          n["buyer-name"]?.ita?.[0] ??
          n["buyer-name"]?.eng?.[0] ??
          n["buyer-name"]?.en?.[0] ??
          "",
        publicationDate: n["publication-date"] ?? null,
        deadline: n["deadline-date-lot"] ?? null,
        cpv: n["classification-cpv"] ?? null,
        links: n.links ?? null,

        // NEW: helper fields for the agent to follow your prompt
        pdf_preferred: pdfItaOrEn, // <- Italian PDF if available, else English
        description_proposed_it: desc_it, // <- IT text candidate to summarise
        description_proposed_en: desc_en, // <- EN fallback if IT missing

        summary_it: null,
        summary_en: null,
      };
    }) as TenderLite[];
  },
});

/* -------------------- save_tender_summary -------------------- */
const SaveSummaryInput = z.object({
  tenderId: z.string().min(1),
  summary_it: z.string().optional(),
  summary_en: z.string().optional(),
});

export const saveTenderSummaryTool = safeTool({
  name: "save_tender_summary",
  description: "Persist AI-generated summaries for a tender in Firestore.",
  schema: SaveSummaryInput,
  fn: async ({ tenderId, summary_it, summary_en }) => {
    const clean = (s?: string | null, max = 600) =>
      (s ?? "")
        .replace(/```[\s\S]*?```/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max) || null;

    await saveTenderSummary(tenderId, {
      summary_it: clean(summary_it, 600),
      summary_en: clean(summary_en, 220),
    });
    return "OK";
  },
});

/* -------------------- save_match_score -------------------- */
const SaveScoreInput = z.object({
  companyId: z.string().min(1),
  tenderId: z.string().min(1),
  score: z.number().min(0).max(1).default(0),
});

export const saveMatchScoreTool = safeTool({
  name: "save_match_score",
  description: "Save a company↔tender score.",
  schema: SaveScoreInput,
  fn: async ({ companyId, tenderId, score }) => {
    await saveMatchScore(companyId, tenderId, score);
    return "OK";
  },
});

/* -------------------- get_current_date (server) -------------------- */
export const currentDateTool = new DynamicStructuredTool({
  name: "get_current_date",
  description:
    "Returns the current date in YYYYMMDD (from Firestore server timestamp).",
  schema: z.object({}),
  func: async () => {
    const ref = db.collection("_meta").doc("now");
    await ref.set({ now: serverTimestamp() }, { merge: true });
    const snap = await ref.get();
    const ts = snap.get("now")?.toDate?.() as Date;
    const y = ts.getFullYear();
    const m = String(ts.getMonth() + 1).padStart(2, "0");
    const d = String(ts.getDate()).padStart(2, "0");
    return `${y}${m}${d}`;
  },
});
