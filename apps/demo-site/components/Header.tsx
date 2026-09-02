import Link from 'next/link';

const nav = [
  { href: '/services', label: 'Services' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/help', label: 'Help & FAQ' },
  { href: '/account', label: 'Account' },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pine-800 text-sm font-bold text-white">
            B
          </span>
          <span className="text-lg font-semibold tracking-tight text-pine-900">
            Bergblick Adventures
          </span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-stone-600 transition-colors hover:text-pine-800"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/booking"
            className="rounded-lg bg-pine-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-pine-800"
          >
            Book now
          </Link>
        </nav>
      </div>
    </header>
  );
}
