import { db } from "./firebase";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import type { TenderDoc } from "./types";

export async function fetchRecentTenders(opts?: {
  q?: string;
  onlyProcessed?: boolean;
  take?: number;
}) {
  const col = collection(db, "tenders");
  const constraints: any[] = [];
  if (opts?.onlyProcessed) constraints.push(where("processed", "==", true));
  // order by updatedAt if you store it; otherwise by id desc (string)
  // constraints.push(orderBy("updatedAt", "desc"));
  const qRef = query(col, ...constraints, limit(opts?.take ?? 25));
  const snap = await getDocs(qRef);
  const data: TenderDoc[] = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  }));
  // naive client-side filter by query text
  if (opts?.q) {
    const qLower = opts.q.toLowerCase();
    return data.filter(
      (t) =>
        t.title?.toLowerCase().includes(qLower) ||
        t.buyer?.toLowerCase().includes(qLower) ||
        t.summary_it?.toLowerCase().includes(qLower) ||
        t.summary_en?.toLowerCase().includes(qLower)
    );
  }
  return data;
}
