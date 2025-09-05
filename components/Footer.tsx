export function Footer() {
  return (
    <footer className="mt-10 border-t">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2">
        <div>© {new Date().getFullYear()} Tender Agent</div>
        <div className="flex gap-4">
          <a
            href="https://ted.europa.eu"
            target="_blank"
            rel="noopener"
            className="hover:underline"
          >
            TED
          </a>
          <a href="/privacy" className="hover:underline">
            Privacy
          </a>
          <a href="/terms" className="hover:underline">
            Termini
          </a>
        </div>
      </div>
    </footer>
  );
}
