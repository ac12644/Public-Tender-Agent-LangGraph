import { safeTool } from "./tooling";
import { z } from "zod";

const QueryIntent = z.object({
  country: z.string().default("ITA"),
  daysBack: z.number().int().min(0).max(30).default(3),
  cpv: z.array(z.string()).optional(), // e.g., ["90911200"]
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
      // "title" and "description" fuzzy match:
      parts.push(
        `(title ~ "${text.trim()}" OR description-proc ~ "${text.trim()}")`
      );
    }
    return parts.join(" AND ");
  },
});
