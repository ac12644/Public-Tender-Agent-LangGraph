import { onRequest } from "firebase-functions/v2/https";
import { upsertTender } from "../lib/firestore";
import { tedSearch } from "../lib/ted";
import { TenderDoc } from "../lib/types";

function makeQuery(daysBack: number) {
  // Relative-only dates are the most reliable across the TED estate
  return `(place-of-performance IN (ITA)) AND (publication-date >= today(-${daysBack}) AND publication-date <= today())`;
}

export const tedPull = onRequest(
  {
    region: "europe-west1",
    cors: true,
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (req, res) => {
    try {
      const firstQ = (req.query.q as string) || makeQuery(3); // last 3 days by default
      const limit = Math.min(Number(req.query.limit ?? 50), 100);

      let notices = await tedSearch({ q: firstQ, limit });

      // Fallback: widen the window if we got nothing
      if (!Array.isArray(notices) || notices.length === 0) {
        const fallbackQ = makeQuery(7);
        console.warn(
          `tedPull: no results for first query; retrying with 7-day window`
        );
        notices = await tedSearch({ q: fallbackQ, limit });
      }

      const ids: string[] = [];
      for (const n of notices) {
        const id = n?.["publication-number"];
        if (!id) continue;

        const title =
          n?.["notice-title"]?.ita ??
          n?.["notice-title"]?.eng ??
          n?.["notice-title"]?.en ??
          "";

        const buyer =
          n?.["buyer-name"]?.ita?.[0] ??
          n?.["buyer-name"]?.eng?.[0] ??
          n?.["buyer-name"]?.en?.[0] ??
          "";

        // Normalize everything that could be undefined to null for Firestore
        const doc: TenderDoc = {
          id: String(id),
          title: String(title),
          buyer: String(buyer),
          publicationDate: n?.["publication-date"] ?? null,
          deadline: n?.["deadline-date-lot"] ?? null,
          cpv: n?.["classification-cpv"] ?? null,
          nuts: null,
          links: n?.links ?? null,
          processed: false,
          summary_it: null,
          summary_en: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await upsertTender(doc);
        ids.push(String(id));
      }

      res.json({ pulled: ids.length, notices: ids });
    } catch (e: any) {
      console.error("tedPull error:", e);
      res.status(500).json({ error: e?.message ?? "TED pull failed" });
    }
  }
);
