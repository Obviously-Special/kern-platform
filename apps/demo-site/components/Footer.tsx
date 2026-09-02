import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-stone-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-3">
        <div>
          <p className="font-semibold text-pine-900">Bergblick Adventures</p>
          <p className="mt-2 text-sm text-stone-500">
            Guided mountain experiences since 2009. Certified Swiss mountain
            guides, fully insured tours.
          </p>
        </div>
        <div>
          <p className="font-semibold text-pine-900">Contact</p>
          <ul className="mt-2 space-y-1 text-sm text-stone-500">
            <li>Dorfstrasse 12, 3818 Grindelwald</li>
            <li>+41 33 555 18 20</li>
            <li>hello@bergblick.example</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-pine-900">Company</p>
          <ul className="mt-2 space-y-1 text-sm text-stone-500">
            <li>
              <Link href="/services" className="hover:text-pine-700">
                Services
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="hover:text-pine-700">
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/help" className="hover:text-pine-700">
                Help & FAQ
              </Link>
            </li>
            <li>Terms & Conditions</li>
            <li>Cancellation policy</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-stone-100 py-4 text-center text-xs text-stone-400">
        © 2026 Bergblick Adventures AG — Demo website for KERN platform development
      </div>
    </footer>
  );
}
