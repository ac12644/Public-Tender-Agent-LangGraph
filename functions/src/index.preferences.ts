import { onRequest } from "firebase-functions/v2/https";
import { db, serverTimestamp } from "./lib/firestore";

type Prefs = {
  regions?: string[];
  cpv?: string[];
  daysBack?: number;
  minValue?: number | null;
  sectors?: string[];
  notifyDaily?: boolean;
};

function getUidFromHeaders(req: any): string {
  const uid =
    (req.headers["x-user-id"] as string) ||
    (req.headers["X-User-Id"] as string) ||
    (req.headers["x-userid"] as string) ||
    "anon";
  return uid;
}

function parseJsonBody(body: any): any {
  if (!body) {
    return {};
  }
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

export const preferences = onRequest(
  { region: "europe-west1", cors: true },
  async (req, res): Promise<void> => {
    try {
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      const uid = getUidFromHeaders(req);
      const ref = db.collection("profiles").doc(uid);

      if (req.method === "GET") {
        const snap = await ref.get();
        const data = (snap.exists ? snap.data() : {}) || {};
        const out = {
          preferences: {
            regions: Array.isArray(data.regions) ? data.regions : [],
            cpv: Array.isArray(data.cpv) ? data.cpv : [],
            daysBack: typeof data.daysBack === "number" ? data.daysBack : 7,
            minValue: typeof data.minValue === "number" ? data.minValue : null,
            sectors: Array.isArray(data.sectors) ? data.sectors : [],
            notifyDaily: !!data.notifyDaily,
          } as Prefs,
        };
        res.json(out);
        return;
      }

      if (req.method === "POST") {
        const incoming = parseJsonBody(req.body) as Prefs;
        const clean: Prefs = {
          regions: Array.isArray(incoming.regions)
            ? incoming.regions.slice(0, 20)
            : [],
          cpv: Array.isArray(incoming.cpv) ? incoming.cpv.slice(0, 40) : [],
          daysBack: Math.min(Math.max(Number(incoming.daysBack ?? 7), 1), 30),
          minValue:
            incoming.minValue == null
              ? null
              : Math.max(0, Number(incoming.minValue)),
          sectors: Array.isArray(incoming.sectors)
            ? incoming.sectors.slice(0, 20)
            : [],
          notifyDaily: !!incoming.notifyDaily,
        };

        await ref.set(
          {
            ...clean,
            updatedAt: serverTimestamp(),
          },
          { merge: false }
        );

        const response = { ok: true, preferences: clean };
        res.json(response);
        return;
      }

      res.status(405).json({ error: "Metodo non supportato" });
    } catch (e: any) {
      console.error("preferences ERROR:", e?.stack || e?.message || String(e));
      res.status(500).json({ error: e?.message ?? "Errore preferenze" });
    }
  }
);
