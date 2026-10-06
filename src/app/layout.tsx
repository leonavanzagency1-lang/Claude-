import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Offert från platsbesöket",
  description: "Ta fram offertutkast direkt från platsbesöket",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const NAV = [
  { href: "/", label: "Offerter" },
  { href: "/offerter/ny", label: "Nytt platsbesök" },
  { href: "/prislista", label: "Prislista" },
  { href: "/installningar", label: "Inställningar" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="sv" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="bg-stone-900 text-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
            <Link href="/" className="mr-2 font-semibold">
              Offert från platsbesöket
            </Link>
            <nav className="-mx-2 flex flex-wrap text-sm">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="rounded px-2 py-1.5 text-stone-200 hover:bg-stone-700 hover:text-white">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">{children}</main>
      </body>
    </html>
  );
}
