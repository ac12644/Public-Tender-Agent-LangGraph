"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { TenderDialog } from "@/components/TenderDialog";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebaseClient";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";

type FavItem = {
  id: string; // Firestore doc id
  tenderId: string;
  title?: string;
  buyer?: string;
  published?: string | null;
  deadline?: string | null;
  cpv?: string | null;
  pdf?: string | null;
  createdAt?: Timestamp | null;
};

export default function PreferitiPage() {
  const { user, loading: authLoading, signInGoogle, isAnon } = useAuth();
  const [items, setItems] = React.useState<FavItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (authLoading || !user) return;

    const q = query(
      collection(db, "saved"),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: FavItem[] = snap.docs.map((d) => {
          const data = d.data() as Omit<FavItem, "id">;
          return { id: d.id, ...data };
        });
        setItems(list);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [authLoading, user]);

  async function remove(item: FavItem) {
    await deleteDoc(doc(db, "saved", item.id));
  }

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-5xl p-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border rounded-xl p-3 animate-pulse h-40" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      <h1 className="text-xl font-semibold">Preferiti</h1>

      {isAnon && (
        <div className="mt-3 mb-1 flex items-center justify-between rounded-lg border p-3 text-sm">
          <span>
            Accedi con Google per ritrovare i preferiti su tutti i dispositivi.
          </span>
          <Button size="sm" onClick={signInGoogle}>
            Accedi con Google
          </Button>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((r) => {
          const tedUrl = `https://ted.europa.eu/it/notice/-/detail/${encodeURIComponent(
            r.tenderId
          )}`;
          return (
            <div key={r.id} className="border rounded-xl p-3">
              <div className="text-sm font-semibold line-clamp-2">
                {r.title ?? `Bando ${r.tenderId}`}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {r.buyer ?? "—"}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                {r.published && (
                  <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5">
                    Pubbl. {String(r.published).slice(0, 10)}
                  </span>
                )}
                {r.deadline && (
                  <span className="rounded bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5">
                    Scad. {String(r.deadline).slice(0, 10)}
                  </span>
                )}
                {r.cpv && (
                  <span className="rounded bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5">
                    CPV {r.cpv}
                  </span>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <TenderDialog
                  tenderId={r.tenderId}
                  baseUrl={process.env.NEXT_PUBLIC_TENDER_API_BASE!}
                />
                <Button asChild size="sm" variant="secondary">
                  <a href={tedUrl} target="_blank" rel="noopener">
                    Apri su TED
                  </a>
                </Button>
                <Button size="sm" variant="outline" onClick={() => remove(r)}>
                  Rimuovi
                </Button>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="text-sm text-muted-foreground">
            Non hai ancora salvato nessun bando.
          </div>
        )}
      </div>
    </div>
  );
}
