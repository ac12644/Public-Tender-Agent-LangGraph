import { onRequest } from "firebase-functions/v2/https";
import { tendersCol, serverTimestamp, db } from "../lib/firestore";
import { llmFactory } from "../lib/llm";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";

export const tendersProcess = onRequest(
  { region: "europe-west1", cors: true, timeoutSeconds: 180, memory: "512MiB" },
  async (_req, res): Promise<void> => {
    const snap = await tendersCol()
      .where("processed", "==", false)
      .orderBy("createdAt", "asc")
      .limit(10)
      .get();

    if (snap.empty) {
      res.json({ processed: 0 });
      return;
    }

    const llm = await llmFactory();
    const chain = llm.pipe(new StringOutputParser());

    const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    const CONCURRENCY = 5;
    const chunks: (typeof docs)[] = [];
    for (let i = 0; i < docs.length; i += CONCURRENCY)
      chunks.push(docs.slice(i, i + CONCURRENCY));

    let processed = 0;
    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(async (t) => {
          const system =
            "Riassumi per un imprenditore italiano: titolo, stazione appaltante, scadenza, CPV se noto, valore se presente. " +
            "Includi una riga in inglese brevissima prefissata con 'EN: '. Risposta breve, senza formattazioni speciali.";
          const content = `Titolo: ${t.title}
Buyer: ${t.buyer}
Pubblicazione: ${t.publicationDate ?? "N/D"}
Scadenza: ${t.deadline ?? "N/D"}`;

          const text = (
            await chain.invoke([
              new SystemMessage(system),
              new HumanMessage(content),
            ])
          ).trim();

          let summary_it = text;
          let summary_en = "";
          const idx = text.indexOf("EN:");
          if (idx >= 0) {
            summary_it = text.slice(0, idx).trim();
            summary_en = text.slice(idx + 3).trim();
          }

          return { id: t.id, summary_it, summary_en };
        })
      );

      const batch = db.batch();
      for (const r of results) {
        if (r.status === "fulfilled") {
          const { id, summary_it, summary_en } = r.value;
          batch.set(
            tendersCol().doc(id),
            {
              summary_it,
              summary_en,
              processed: true,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          processed += 1;
        }
      }
      await batch.commit();
    }

    res.json({ processed });
  }
);
