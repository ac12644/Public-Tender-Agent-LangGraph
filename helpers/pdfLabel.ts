export function pdfLabelFromUrl(url?: string): "PDF (IT)" | "PDF (EN)" | "PDF" {
  if (!url) return "PDF";
  const u = url.toLowerCase();
  if (u.includes("/it/") || u.includes("/ita/")) return "PDF (IT)";
  if (u.includes("/en/") || u.includes("/eng/")) return "PDF (EN)";
  return "PDF";
}
