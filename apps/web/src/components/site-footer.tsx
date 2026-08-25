import Link from "next/link";

const nav = [
  { href: "/", label: "Home" },
  { href: "/fighters", label: "Fighters" },
  { href: "/about", label: "About Us" },
  { href: "/apply", label: "Apply as a Fighter" },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-muted">
        <p>No Mercy Fighting Championship</p>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
