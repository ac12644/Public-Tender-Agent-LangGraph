import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";

type ToolFn<I, O> = (input: I) => Promise<O>;

export function safeTool<I, O>({
  name,
  description,
  schema,
  fn,
  timeoutMs = 15_000,
  retries = 2,
}: {
  name: string;
  description: string;
  schema: z.ZodType<I>;
  fn: ToolFn<I, O>;
  timeoutMs?: number;
  retries?: number;
}) {
  return new DynamicStructuredTool({
    name,
    description,
    schema,
    func: async (raw) => {
      const input = schema.parse(raw);
      let lastErr: unknown;

      // Proper timeout wrapper that doesn’t rely on AbortController propagation.
      const withTimeout = <T>(p: Promise<T>) =>
        new Promise<T>((resolve, reject) => {
          const t = setTimeout(
            () =>
              reject(new Error(`tool:${name} timed out after ${timeoutMs}ms`)),
            timeoutMs
          );
          p.then((v) => {
            clearTimeout(t);
            resolve(v);
          }).catch((e) => {
            clearTimeout(t);
            reject(e);
          });
        });

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          // Ensure serializable return
          const out = await withTimeout(fn(input));
          return out as any;
        } catch (e) {
          lastErr = e;
          // incremental backoff
          await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        }
      }
      throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
    },
  });
}
