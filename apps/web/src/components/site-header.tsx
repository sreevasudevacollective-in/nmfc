import Link from "next/link";

const nav = [
  { href: "/", label: "Home" },
  { href: "/fighters", label: "Fighters" },
  { href: "/about", label: "About Us" },
  { href: "/apply", label: "Apply as a Fighter" },
] as const;

export function SiteHeader() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="text-sm font-semibold tracking-[0.2em] uppercase">
          NMFC
        </Link>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
