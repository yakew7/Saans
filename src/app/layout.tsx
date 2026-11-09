import type { Metadata, Viewport } from "next";
import { Figtree, Fraunces } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BottomTabs } from "@/components/layout/BottomTabs";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { AlertsRunner } from "@/components/alerts/AlertsRunner";
import { ToastHost } from "@/components/alerts/ToastHost";
import { PwaRegister } from "@/components/layout/PwaRegister";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap", axes: ["opsz"] });
const text = Figtree({ subsets: ["latin"], variable: "--font-text", display: "swap" });

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Saans — real-time air quality you can act on", template: "%s · Saans" },
  description:
    "Know your air, decide your day. Live AQI from real stations, honest provenance on every number, forecasts, history and health guidance for any city.",
  icons: { icon: [{ url: "/icons/192", sizes: "192x192", type: "image/png" }], apple: [{ url: "/icons/192" }] },
  applicationName: "Saans",
  openGraph: { title: "Saans — breathe better", description: "Real-time air quality intelligence with honest data provenance.", type: "website" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1211" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${text.variable}`}>
      <body>
        <Providers>
          <SiteHeader />
          <main id="main" className="mx-auto min-h-[90dvh] max-w-7xl px-4 pt-6">
            {children}
          </main>
          <SiteFooter />
          <BottomTabs />
          <AlertsRunner />
          <ToastHost />
          <PwaRegister />
        </Providers>
      </body>
    </html>
  );
}
