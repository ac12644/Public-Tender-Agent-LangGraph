"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Download,
  ExternalLink,
  RefreshCcw,
  Star,
} from "lucide-react";

const BASE_URL = process.env.NEXT_PUBLIC_TENDER_API_BASE ?? "";

function getOrCreateUID(): string {
  if (typeof window === "undefined") return "anon";
  const key = "tender_uid";
  let uid = localStorage.getItem(key);
  if (!uid) {
    uid = crypto.randomUUID();
    localStorage.setItem(key, uid);
  }
  return uid;
}

type Row = {
  pubno: string;
  noticeId: string;
  buyer: string;
  title: string;
  published: string | null;
  deadline: string | null;
  cpv: string | null;
  value: number | null;
  pdf: string | null;
  score: number;
};

type Prefs = {
  regions: string[];
  cpv: string[];
  daysBack: number;
  minValue: number | null;
  sectors: string[];
  notifyDaily: boolean;
};

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function toISODate(v?: string | null): string | null {
  if (!v) return null;
  const clean = v.replace(/T\d{2}:\d{2}:\d{2}.*$/, "").replace(/\+.*/, "");
  const d = new Date(clean);
  return Number.isNaN(d.getTime()) ? clean : d.toISOString().slice(0, 10);
}

function fmtMoney(input?: number | null): string {
  if (input == null) return "—";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(input);
}

async function exportCsvFromRows(rows: Row[]) {
  const res = await fetch(`${BASE_URL}/exportCsv`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rows: rows.map((r) => ({
        pubno: r.pubno,
        buyer: r.buyer,
        title: r.title,
        published: r.published,
        deadline: r.deadline,
        cpv: r.cpv,
        value: r.value ?? "",
        pdf: r.pdf ?? "",
      })),
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tenders.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/* ----------------- Card ----------------- */
function TenderCard({ r }: { r: Row }) {
  const tedUrl = `https://ted.europa.eu/it/notice/-/detail/${encodeURIComponent(
    r.noticeId || r.pubno
  )}`;
  const pdfUrl = r.pdf && /^https?:\/\//i.test(r.pdf) ? r.pdf : null;
  const pdfLabel = pdfUrl?.includes("/it/")
    ? "PDF (IT)"
    : pdfUrl?.includes("/en/")
    ? "PDF (EN)"
    : "PDF";

  return (
    <Card className="border bg-gradient-to-b from-muted/40 to-background hover:shadow-md transition">
      <CardContent className="p-4">
        <div className="text-sm font-semibold leading-snug line-clamp-2">
          {r.title || "Bando"}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {r.buyer || "—"}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200 px-2 py-0.5">
            PubNo: {r.pubno}
          </span>
          {r.published && (
            <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 px-2 py-0.5">
              Pubbl.: {r.published}
            </span>
          )}
          {r.deadline && (
            <span className="rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-200 px-2 py-0.5">
              Scad.: {r.deadline}
            </span>
          )}
          {r.cpv && (
            <Badge
              variant="secondary"
              className="rounded-full text-[11px] bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-200"
            >
              CPV {r.cpv}
            </Badge>
          )}
        </div>

        <div className="mt-3 text-sm font-semibold">
          <span className="inline-flex items-center rounded-lg bg-emerald-600/10 px-2 py-1">
            <span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-600" />
            {fmtMoney(r.value)}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {pdfUrl && (
            <Button asChild size="sm" className="gap-1">
              <Link href={pdfUrl} target="_blank" rel="noopener">
                {pdfLabel} <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
          <Button asChild size="sm" variant="secondary" className="gap-1">
            <Link href={tedUrl} target="_blank" rel="noopener">
              Apri su TED <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ----------------- Hooks: feed + prefs ----------------- */
function useFeedAndPrefs() {
  const uid = React.useMemo(getOrCreateUID, []);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [prefs, setPrefs] = React.useState<Prefs | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [err, setErr] = React.useState<string | null>(null);

  const reload = async () => {
    try {
      setLoading(true);
      setErr(null);

      const [prefRes, feedRes] = await Promise.all([
        fetch(`${BASE_URL}/preferences`, {
          headers: { "x-user-id": uid },
          cache: "no-store",
        }),
        fetch(`${BASE_URL}/feed`, {
          headers: { "x-user-id": uid },
          cache: "no-store",
        }),
      ]);

      if (!prefRes.ok) throw new Error(await prefRes.text());
      if (!feedRes.ok) throw new Error(await feedRes.text());

      const prefJson = (await prefRes.json()) as { preferences: Prefs };
      const feedJson = (await feedRes.json()) as { rows: Row[] };

      setPrefs(prefJson.preferences);

      const mapped = (feedJson.rows ?? []).map((r) => ({
        ...r,
        published: toISODate(r.published),
        deadline: toISODate(r.deadline),
      }));
      setRows(mapped);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : typeof e === "string" ? e : "Errore";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void reload();
  }, []);

  return { uid, rows, prefs, loading, err, reload };
}

/* ----------------- Page ----------------- */
export default function PersonalizedFeedPage() {
  const { rows, prefs, loading, err, reload } = useFeedAndPrefs();

  const [query, setQuery] = useState("");
  const [minValueFilter, setMinValueFilter] = useState<string>("");

  const filtered = React.useMemo(() => {
    if (!rows.length) return rows;

    let data = rows;

    if (prefs) {
      const now = new Date();
      const wantedRegions = (prefs.regions ?? []).map(normalize);
      const wantedCpv = (prefs.cpv ?? [])
        .map((c) => String(c).trim())
        .filter(Boolean);
      const minVal = prefs.minValue == null ? null : Number(prefs.minValue);
      const days = Math.max(1, Number(prefs.daysBack ?? 7));

      data = data.filter((r) => {
        const buyerN = normalize(r.buyer || "");
        const titleN = normalize(r.title || "");
        const haystack = `${buyerN} ${titleN}`;

        const regionOk =
          wantedRegions.length === 0 ||
          wantedRegions.some((rg) => haystack.includes(rg));

        const cpvStr = (r.cpv ?? "").trim();
        const cpvOk =
          wantedCpv.length === 0 ||
          (cpvStr !== "" && wantedCpv.some((w) => cpvStr.startsWith(w)));

        const valueOk = minVal == null || (r.value ?? 0) >= minVal;

        const dateOk = (() => {
          if (!r.published) return true;
          const d = new Date(r.published);
          if (Number.isNaN(d.getTime())) return true;
          const diffDays = (now.getTime() - d.getTime()) / 86_400_000;
          return diffDays <= days + 0.5;
        })();

        return regionOk && cpvOk && valueOk && dateOk;
      });
    }

    return data;
  }, [rows, prefs]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Per te</h1>
          <p className="text-sm text-muted-foreground">
            Bandi personalizzati in base alle tue preferenze.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={reload}
            className="gap-1"
          >
            <RefreshCcw className="h-4 w-4" /> Aggiorna
          </Button>
          <Button
            size="sm"
            className="gap-1"
            onClick={() => exportCsvFromRows(filtered)}
            disabled={!filtered.length}
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2 flex items-center gap-2">
          <Input
            placeholder="Cerca per titolo, stazione appaltante o CPV…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Input
            placeholder="Valore minimo €"
            value={minValueFilter}
            onChange={(e) => setMinValueFilter(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Badge variant="secondary" className="gap-1">
            <Star className="h-3.5 w-3.5" />
            {filtered.length} risultati
          </Badge>
        </div>
      </div>

      {err && (
        <div className="mt-4 rounded-lg border border-destructive/40 text-destructive bg-destructive/5 p-3">
          {err}
        </div>
      )}

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Caricamento feed…
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <TenderCard key={r.noticeId || r.pubno} r={r} />
          ))}
          {!filtered.length && (
            <div className="col-span-full text-sm text-muted-foreground border rounded-lg p-6 text-center">
              Nessun risultato. Modifica preferenze o filtri di ricerca.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
