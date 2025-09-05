"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ExternalLink, Loader2, RefreshCcw } from "lucide-react";

/* -------------------------------------------------------
 * Config
 * ----------------------------------------------------- */
const BASE_URL = process.env.NEXT_PUBLIC_TENDER_API_BASE ?? "";

/* -------------------------------------------------------
 * UID (puoi sostituire con Firebase Auth)
 * ----------------------------------------------------- */
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

/* -------------------------------------------------------
 * Helpers
 * ----------------------------------------------------- */
type BackendMessage = {
  role?: string;
  type?: string;
  name?: string;
  content?: unknown;
  _getType?: () => string;
};

function toPlainText(content: unknown): string {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((p: unknown) => {
        if (typeof p === "string") return p;
        if (p && typeof p === "object") {
          const obj = p as {
            text?: unknown;
            content?: unknown;
            value?: unknown;
          };
          if (typeof obj.text === "string") return obj.text;
          if (typeof obj.content === "string") return obj.content;
          if (typeof obj.value === "string") return obj.value;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  if (content && typeof content === "object") {
    const obj = content as { text?: unknown; content?: unknown };
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.content === "string") return obj.content;
    try {
      return JSON.stringify(content);
    } catch {
      return String(content);
    }
  }
  return "";
}

function cleanAssistantText(s: string): string {
  if (!s) return "";
  const withoutToolBlocks = s.replace(/^```[\s\S]*?```[\r\n]*/g, "").trim();
  return withoutToolBlocks.replace(/\n{3,}/g, "\n\n");
}

/* -------- Parse tabella compatta in card bandi -------- */
type ParsedTenderRow = {
  pubno: string;
  noticeId?: string;
  buyer: string;
  title: string;
  published?: string;
  deadline?: string;
  cpv?: string;
  value?: string | number;
  pdf?: string;
  description?: string;
};

function normalizeIsoLike(d?: string): string | undefined {
  if (!d) return undefined;
  const clean = d.replace(/T\d{2}:\d{2}:\d{2}.*$/, "").replace(/\+.*/, "");
  const dt = new Date(clean);
  return isNaN(dt.getTime()) ? d : dt.toISOString().slice(0, 10);
}

function parseTendersFromMarkdownTable(md: string): ParsedTenderRow[] {
  const cleaned = md.replace(/```[\s\S]*?```/g, "").trim();
  const tableMatch = cleaned.match(
    /(^|\n)\s*\|(.+\|)\s*\n\|[-:| ]+\|\s*\n([\s\S]*?)(\n{2,}|$)/
  );
  if (!tableMatch) return [];

  const headerLine = tableMatch[2].trim();
  const rowsBlock = tableMatch[3].trim();

  const headers = headerLine
    .split("|")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

  const col = {
    pubno: headers.findIndex(
      (h) => h.includes("pubno") || h.includes("publication")
    ),
    noticeId: headers.findIndex(
      (h) => h === "noticeid" || h === "id" || h.includes("notice")
    ),
    buyer: headers.findIndex((h) => h.includes("buyer")),
    title: headers.findIndex((h) => h.includes("title")),
    published: headers.findIndex((h) => h.includes("publish")),
    deadline: headers.findIndex(
      (h) => h.includes("deadline") || h.includes("scadenza")
    ),
    cpv: headers.findIndex((h) => h.includes("cpv")),
    value: headers.findIndex((h) =>
      ["value", "valore", "importo", "amount"].some((k) => h.includes(k))
    ),
    pdf: headers.findIndex((h) => h === "pdf"),
    description: headers.findIndex(
      (h) => h === "description" || h.includes("descr")
    ),
  };

  const get = (cols: string[], idx: number) =>
    idx >= 0 && idx < cols.length ? cols[idx].trim() : "";

  return rowsBlock
    .split("\n")
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim())
    )
    .filter((cols) => cols.length >= 3 && cols.some(Boolean))
    .map((cols) => ({
      pubno: get(cols, col.pubno),
      noticeId: get(cols, col.noticeId) || undefined,
      buyer: get(cols, col.buyer),
      title: get(cols, col.title),
      published: normalizeIsoLike(get(cols, col.published)) || undefined,
      deadline: normalizeIsoLike(get(cols, col.deadline)) || undefined,
      cpv: get(cols, col.cpv) || undefined,
      value: get(cols, col.value) || undefined,
      pdf: get(cols, col.pdf) || undefined,
      description: get(cols, col.description) || undefined,
    }))
    .filter((r) => r.title || r.pubno);
}

function fmtMoney(input?: string | number | null): string {
  if (input == null || input === "") return "—";
  if (typeof input === "number" && !isNaN(input)) {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(input);
  }
  return String(input);
}

/* -------------------------------------------------------
 * Suggerimenti “intelligenti” locali
 * ----------------------------------------------------- */
const SUGG_KEY = "tender_last_prompts";

function rememberPrompt(p: string) {
  try {
    const raw = localStorage.getItem(SUGG_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    const out = [p, ...arr.filter((x) => x !== p)].slice(0, 6);
    localStorage.setItem(SUGG_KEY, JSON.stringify(out));
  } catch {}
}

function loadSuggestions(): string[] {
  try {
    const raw = localStorage.getItem(SUGG_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    // seed di base in mancanza di storico
    const seed = [
      "trova bandi informatica pubblicati oggi in Italia",
      "mostra bandi con scadenza entro 7 giorni in Lombardia",
      "riassumi i bandi più recenti (max 5)",
    ];
    return arr.length ? arr : seed;
  } catch {
    return [
      "trova bandi informatica pubblicati oggi in Italia",
      "mostra bandi con scadenza entro 7 giorni in Lombardia",
      "riassumi i bandi più recenti (max 5)",
    ];
  }
}

/* -------------------------------------------------------
 * UI semplici
 * ----------------------------------------------------- */
function SuggestionChips({
  suggestions,
  onPick,
  disabled,
}: {
  suggestions: string[];
  onPick: (s: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex justify-end">
      <div className="relative max-w-[85%] px-3 py-2">
        <div className="flex flex-col gap-2">
          {suggestions.map((s, i) => (
            <Button
              key={s + i}
              type="button"
              size="sm"
              variant="ghost"
              aria-label={`Suggerimento ${i + 1}: ${s}`}
              className={[
                "w-full justify-start",
                "rounded-lg",
                "border border-border/60",
                "bg-background hover:bg-muted",
                "text-foreground",
                "cursor-pointer",
                "px-3 py-2",
                "shadow-sm transition-transform",
                "hover:-translate-y-0.5 active:translate-y-0",
                "focus-visible:ring-2 focus-visible:ring-primary/40",
              ].join(" ")}
              onClick={() => onPick(s)}
              disabled={!!disabled}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------
 * Card bando (riuso della tabella compatta)
 * ----------------------------------------------------- */
function TenderCard({ row }: { row: ParsedTenderRow }) {
  const idForUrl = row.noticeId || row.pubno;
  const tedUrl = idForUrl
    ? `https://ted.europa.eu/it/notice/-/detail/${encodeURIComponent(idForUrl)}`
    : undefined;

  const pdfUrl = row.pdf && /^https?:\/\//i.test(row.pdf) ? row.pdf : undefined;
  const pdfLabel = pdfUrl?.includes("/it/")
    ? "PDF (IT)"
    : pdfUrl?.includes("/en/")
    ? "PDF (EN)"
    : "PDF";

  return (
    <Card className="border bg-gradient-to-b from-muted/40 to-background hover:shadow-md transition">
      <CardContent className="p-4">
        <div className="text-sm font-semibold leading-snug line-clamp-2">
          {row.title || "Bando"}
        </div>

        <div className="mt-1 text-xs text-muted-foreground">
          {row.buyer || "—"}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          {row.pubno && (
            <span className="rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200 px-2 py-0.5">
              PubNo: {row.pubno}
            </span>
          )}
          {row.published && (
            <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 px-2 py-0.5">
              Pubbl.: {row.published}
            </span>
          )}
          {row.deadline && (
            <span className="rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-200 px-2 py-0.5">
              Scad.: {row.deadline}
            </span>
          )}
          {row.cpv && (
            <Badge
              variant="secondary"
              className="rounded-full text-[11px] bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-200"
            >
              CPV {row.cpv}
            </Badge>
          )}
        </div>

        {row.description && (
          <p className="mt-3 text-[13px] text-muted-foreground line-clamp-3">
            {row.description}
          </p>
        )}

        {row.value && (
          <div className="mt-3 text-sm font-semibold">
            <span className="inline-flex items-center rounded-lg bg-emerald-600/10 px-2 py-1">
              <span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-600" />
              {fmtMoney(row.value)}
            </span>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {pdfUrl && (
            <Button asChild size="sm" className="gap-1">
              <Link href={pdfUrl} target="_blank" rel="noopener">
                {pdfLabel} <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
          {tedUrl && (
            <Button asChild size="sm" variant="secondary" className="gap-1">
              <Link href={tedUrl} target="_blank" rel="noopener">
                Apri su TED <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------
 * Messaggi Chat
 * ----------------------------------------------------- */
type ChatMsg = { role: "user" | "assistant"; content: string };

function AssistantMessage({ text }: { text: string }) {
  const parsed = React.useMemo(
    () => parseTendersFromMarkdownTable(text),
    [text]
  );

  if (parsed.length > 0) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {parsed.map((r, i) => (
          <TenderCard key={`${r.noticeId || r.pubno}-${i}`} row={r} />
        ))}
      </div>
    );
  }
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {cleanAssistantText(text)}
      </ReactMarkdown>
    </div>
  );
}

/* -------------------------------------------------------
 * Pagina principale
 * ----------------------------------------------------- */
export default function HomePage() {
  const uid = useMemo(getOrCreateUID, []);
  const [threadId] = useState(() => crypto.randomUUID());

  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "Ciao! Sono il tuo Tender Agent. Dimmi cosa cerchi (es: *software* oggi in *Lombardia*).",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const [suggestions, setSuggestions] = useState<string[]>(loadSuggestions());

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content) return;

    rememberPrompt(content);
    setSuggestions(loadSuggestions());

    setMessages((prev) => [...prev, { role: "user", content }]);
    setInput("");
    setLoading(true);

    try {
      interface AgentChatResponse {
        messages: BackendMessage[];
      }
      const res = await fetch(`${BASE_URL}/agentChat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": uid,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content }],
          thread_id: threadId,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as AgentChatResponse;

      const assistant = pickLastAssistantMessage(data.messages);
      if (assistant && assistant.content) {
        setMessages((prev) => [...prev, assistant]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Ho ricevuto la risposta dal backend, ma non c'era testo da mostrare.",
          },
        ]);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Errore: ${message}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function pickLastAssistantMessage(
    raw: BackendMessage[]
  ): { role: "assistant"; content: string } | null {
    if (!Array.isArray(raw)) return null;
    for (let i = raw.length - 1; i >= 0; i--) {
      const m = raw[i];
      const role = m?.role ?? m?._getType?.() ?? m?.type;
      const asst =
        role === "assistant" ||
        role === "ai" ||
        role === "AIMessages" ||
        role === "tool" ||
        m?.name === "agent";
      if (asst) {
        const text = toPlainText(m?.content);
        if (text) return { role: "assistant", content: text };
      }
    }
    const joined = raw
      .map((m) => toPlainText(m?.content))
      .filter(Boolean)
      .join("\n")
      .trim();
    return joined ? { role: "assistant", content: joined } : null;
  }

  const firstUserIndex = React.useMemo(
    () => messages.findIndex((m) => m.role === "user"),
    [messages]
  );

  const showSuggestions =
    firstUserIndex === -1 ||
    (messages[messages.length - 1]?.role === "assistant" &&
      input.trim() === "");

  return (
    <div className="flex h-dvh w-full flex-col bg-background text-foreground">
      {/* Corpo */}
      <main className="flex-1 overflow-hidden">
        <div className="mx-auto h-full w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2 text-sm text-muted-foreground">
              Chiedi bandi in linguaggio naturale. Esempio:{" "}
              <span className="text-foreground italic">
                “trova bandi pulizia in Lombardia pubblicati oggi”
              </span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setMessages([
                    {
                      role: "assistant",
                      content:
                        "Nuova chat. Dimmi cosa cerchi (es: *software* in *Lazio* pubblicati *oggi*).",
                    },
                  ])
                }
                className="gap-1"
              >
                <RefreshCcw className="h-4 w-4" />
                Nuova chat
              </Button>
            </div>
          </div>

          {/* Contenitore chat */}
          <div className="mt-3 flex h-[calc(100dvh-4rem-6.5rem)] flex-col rounded-2xl border bg-muted/20 p-3 sm:p-4">
            {/* Stream */}
            <div
              ref={scrollerRef}
              className="flex-1 overflow-y-auto rounded-xl bg-background/60 p-2 sm:p-3"
            >
              <div className="space-y-3">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${
                      m.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm ${
                        m.role === "user"
                          ? "bg-primary text-primary-foreground shadow"
                          : ""
                      }`}
                    >
                      {m.role === "assistant" ? (
                        <AssistantMessage text={m.content} />
                      ) : (
                        <span>{m.content}</span>
                      )}
                    </div>
                  </div>
                ))}

                {showSuggestions && (
                  <SuggestionChips
                    suggestions={suggestions}
                    onPick={(s) => !loading && send(s)}
                    disabled={loading}
                  />
                )}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-background border rounded-2xl px-3 py-2 text-sm shadow inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sto cercando bandi…
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Composer */}
            <div className="sticky bottom-0 mt-3 rounded-xl border bg-background/80 p-2 sm:p-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Scrivi la tua richiesta (Invio per inviare)…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  className="min-h-10"
                  aria-label="Messaggio per Tender Agent"
                />
                <Button
                  onClick={() => send()}
                  disabled={loading}
                  className="min-h-10"
                  aria-label="Invia messaggio"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="pb-[env(safe-area-inset-bottom)]" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
