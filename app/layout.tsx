import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tender Agent — EU tenders made simple",
  description:
    "Cerca, riassumi e apri bandi in un’unica chat. Link PDF IT/EN, scadenze e importi formattati.",
  applicationName: "Tender Agent",
  authors: [{ name: "Tender Agent" }],
  keywords: [
    "TED",
    "tenders",
    "bandi",
    "appalti",
    "EU procurement",
    "Italia",
    "CPV",
  ],
  icons: [
    { rel: "icon", url: "/favicon.ico" },
    { rel: "apple-touch-icon", url: "/apple-touch-icon.png" },
  ],
  openGraph: {
    title: "Tender Agent — EU/TED tenders made simple",
    description:
      "Cerca, riassumi e apri bandi TED in un’unica chat. Link PDF IT/EN, scadenze e importi formattati.",

    siteName: "Tender Agent",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tender Agent — EU/TED tenders made simple",
    description:
      "Cerca, riassumi e apri bandi TED in un’unica chat. Link PDF IT/EN, scadenze e importi formattati.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0ea5e9", // sky-500
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning avoids mismatches caused by extensions
    <html lang="it" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
