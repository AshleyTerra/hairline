import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { Nav } from "@/components/Nav";
import { earningStylists, meta as demoMeta } from "@/lib/data";
import { longDate } from "@/lib/format";

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
          <div className="flex min-h-screen flex-col md:flex-row">
            <Nav />
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="no-print border-b border-hairline bg-chip px-4 py-1.5 text-center text-[11px] text-taupe-deep">
                Prototype — real salon data, demo day {longDate(demoMeta.demoDate)}. Client names
                and numbers are anonymised.
              </p>
              <main className="min-w-0 flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10">{children}</main>
            </div>
          </div>
        </StoreProvider>
      </body>
    </html>
  );
}
