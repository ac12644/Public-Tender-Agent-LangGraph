import { onRequest } from "firebase-functions/v2/https";
import { tedSearch } from "./lib/ted";

function csvEscape(s: any) {
  if (s == null) return "";
  const str = String(s);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export const exportCsv = onRequest(
  { region: "europe-west1", cors: true },
  async (req, res): Promise<void> => {
    if (req.method === "OPTIONS") {
      void res.status(204).send("");
      return;
    }
    try {
      const body = (typeof req.body === "object" ? req.body : {}) as any;
      let rows: any[] | null = Array.isArray(body.rows) ? body.rows : null;

      if (!rows) {
        const q = String(req.query.q ?? "");
        const limit = Math.min(Number(req.query.limit ?? 50), 200);
        if (!q) {
          res.status(400).json({ error: "Manca q o rows" });
          return;
        }
        const notices = await tedSearch({ q, limit });
        rows = notices.map((n: any) => ({
          PubNo: n["publication-number"],
          Buyer:
            n["buyer-name"]?.ita?.[0] ??
            n["buyer-name"]?.eng?.[0] ??
            n["buyer-name"]?.en?.[0] ??
            "",
          Title:
            n["notice-title"]?.ita ??
            n["notice-title"]?.eng ??
            n["notice-title"]?.en ??
            "",
          Published: Array.isArray(n["publication-date"])
            ? n["publication-date"][0]
            : n["publication-date"],
          Deadline: Array.isArray(n["deadline-date-lot"])
            ? n["deadline-date-lot"][0]
            : n["deadline-date-lot"],
          CPV: Array.isArray(n["classification-cpv"])
            ? n["classification-cpv"][0]
            : n["classification-cpv"] ?? "",
          Value:
            typeof n["total-value"] === "number"
              ? n["total-value"]
              : typeof n["estimated-value-glo"] === "number"
              ? n["estimated-value-glo"]
              : "",
          PDF:
            n.links?.pdf?.it ??
            n.links?.pdf?.ITA ??
            n.links?.pdf?.en ??
            n.links?.pdf?.ENG ??
            "",
        }));
      }

      const headers = [
        "PubNo",
        "Buyer",
        "Title",
        "Published",
        "Deadline",
        "CPV",
        "ValueEUR",
        "PDF",
      ];
      const lines = [headers.join(",")];
      for (const r of rows) {
        lines.push(
          [
            csvEscape(r.pubno ?? r.PubNo),
            csvEscape(r.buyer ?? r.Buyer),
            csvEscape(r.title ?? r.Title),
            csvEscape(r.published ?? r.Published),
            csvEscape(r.deadline ?? r.Deadline),
            csvEscape(r.cpv ?? r.CPV),
            csvEscape(r.value ?? r.Value ?? ""),
            csvEscape(r.pdf ?? r.PDF ?? ""),
          ].join(",")
        );
      }
      const csv = lines.join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="tenders.csv"`
      );
      res.send(csv);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e?.message ?? "Export fallito" });
    }
  }
);
