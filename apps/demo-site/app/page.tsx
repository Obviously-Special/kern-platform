import Link from 'next/link';

const highlights = [
  {
    title: 'Certified guides',
    text: 'Every tour is led by a Swiss-certified mountain guide with 10+ years of alpine experience.',
  },
  {
    title: 'Fully insured',
    text: 'All experiences include base liability coverage. Extended cover available at booking.',
  },
  {
    title: 'Small groups',
    text: 'Maximum 8 guests per tour, so you get a personal mountain day — never a crowd.',
  },
];

const tours = [
  {
    name: 'Eiger Panorama Hike',
    duration: 'Half day · 4.5 h',
    difficulty: 'Moderate',
    price: 'CHF 89',
  },
  {
    name: 'Tandem Paragliding',
    duration: '3 h incl. briefing',
    difficulty: 'No experience needed',
    price: 'CHF 190',
  },
  {
    name: 'E-Mountain Bike Tour',
    duration: 'Full day · 6 h',
    difficulty: 'Intermediate',
    price: 'CHF 145',
  },
];

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-pine-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-24">
          <p className="text-sm font-semibold uppercase tracking-widest text-sun-400">
            Grindelwald · Swiss Alps
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight md:text-5xl">
            Your mountain day, guided by people who know every trail.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-stone-300">
            Guided hikes, tandem paragliding, e-bike tours and climbing courses.
            Book online in minutes.
          </p>
          <div className="mt-8 flex gap-4">
            <Link
              href="/booking"
              className="rounded-lg bg-sun-500 px-6 py-3 font-semibold text-pine-900 transition-colors hover:bg-sun-400"
            >
              Book your adventure
            </Link>
            <Link
              href="/services"
              className="rounded-lg border border-white/30 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/10"
            >
              Explore services
            </Link>
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid gap-8 md:grid-cols-3">
          {highlights.map((h) => (
            <div key={h.title} className="rounded-xl border border-stone-200 bg-white p-6">
              <h2 className="font-semibold text-pine-900">{h.title}</h2>
              <p className="mt-2 text-sm text-stone-600">{h.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tours */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold text-pine-900">Most booked this season</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {tours.map((t) => (
              <div key={t.name} className="rounded-xl border border-stone-200 p-6">
                <h3 className="font-semibold text-pine-900">{t.name}</h3>
                <p className="mt-1 text-sm text-stone-500">{t.duration}</p>
                <p className="mt-1 text-sm text-stone-500">{t.difficulty}</p>
                <p className="mt-4 text-lg font-bold text-pine-800">{t.price}</p>
                <Link
                  href="/booking"
                  className="mt-4 inline-block rounded-lg bg-pine-700 px-4 py-2 text-sm font-semibold text-white hover:bg-pine-800"
                >
                  Book this
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-2xl font-bold text-pine-900">What our guests say</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <blockquote className="rounded-xl border border-stone-200 bg-white p-6">
            <p className="text-stone-700">
              “The guide knew exactly when the light would hit the north face.
              A perfect half day — booking took five minutes.”
            </p>
            <footer className="mt-4 text-sm font-semibold text-pine-800">S. Keller, Zurich</footer>
          </blockquote>
          <blockquote className="rounded-xl border border-stone-200 bg-white p-6">
            <p className="text-stone-700">
              “First paragliding flight of my life. The tandem pilot made the
              whole group feel safe from the briefing to the landing.”
            </p>
            <footer className="mt-4 text-sm font-semibold text-pine-800">M. Rossi, Milan</footer>
          </blockquote>
        </div>
      </section>
    </div>
  );
}
