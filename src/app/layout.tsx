import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";

const instrument = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-instrument",
  display: "swap",
});
import { StoreProvider } from "@/lib/store";
import { AppGate } from "@/components/AppGate";
import { earningStylists } from "@/lib/data";

export const metadata: Metadata = {
  title: "Hairline Salon Manager",
  description:
    "Prototype of the Hairline Salon Manager, built on the salon's own data. Client names are anonymised.",
};

export const viewport: Viewport = {
  themeColor: "#8a7f6f",
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en-ZA" className={`h-full ${instrument.variable}`}>
      <body className="min-h-full antialiased">
        <StoreProvider defaultStylistId={earningStylists[0]?.id ?? 1}>
          <AppGate>{children}</AppGate>
        </StoreProvider>
      </body>
    </html>
  );
}
