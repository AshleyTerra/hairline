import type { Metadata, Viewport } from "next";
import "./globals.css";
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
    <html lang="en-ZA" className="h-full">
      <body className="min-h-full antialiased">
        <StoreProvider defaultStylistId={earningStylists[0]?.id ?? 1}>
          <AppGate>{children}</AppGate>
        </StoreProvider>
      </body>
    </html>
  );
}
