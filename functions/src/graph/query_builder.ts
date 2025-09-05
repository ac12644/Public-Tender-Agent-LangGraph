import { safeTool } from "./tooling";
import { z } from "zod";

const QueryIntent = z.object({
  country: z.string().default("ITA"),
  daysBack: z.number().int().min(0).max(30).default(3),
  cpv: z.array(z.string()).optional(),
  text: z.string().optional(),
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
      const t = text.trim().replace(/"/g, '\\"');
      parts.push(`(notice-title ~ "${t}" OR description-proc ~ "${t}")`);
    }
    return parts.join(" AND ");
  },
});
