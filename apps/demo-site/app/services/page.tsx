import Link from 'next/link';

const services = [
  {
    name: 'Eiger Panorama Hike',
    description:
      'Half-day guided hike along the Eiger Trail with views of the north face. Transport to the trailhead included.',
    duration: '4.5 hours',
    difficulty: 'Moderate',
    group: '2–8 guests',
    price: 'CHF 89 per person',
    notes: 'Minimum 2 participants. Hiking boots required.',
  },
  {
    name: 'Tandem Paragliding',
    description:
      'Fly with a licensed tandem pilot from First summit down to the valley. Briefing and equipment included.',
    duration: '3 hours incl. briefing',
    difficulty: 'No experience needed',
    group: '1 guest per pilot',
    price: 'CHF 190 per person',
    notes: 'Weight limit 110 kg. Weather-dependent; rescheduling free of charge.',
  },
  {
    name: 'E-Mountain Bike Tour',
    description:
      'Full-day guided e-bike tour across alpine pastures with a mountain hut lunch stop.',
    duration: '6 hours',
    difficulty: 'Intermediate',
    group: '2–8 guests',
    price: 'CHF 145 per person',
    notes: 'Minimum 2 participants. Bike rental bookable at the next step.',
  },
  {
    name: 'Intro to Rock Climbing',
    description:
      'Learn rope handling, belaying and your first outdoor pitches on real rock with an instructor.',
    duration: '5 hours',
    difficulty: 'Beginner friendly',
    group: '2–6 guests',
    price: 'CHF 120 per person',
    notes: 'Minimum 2 participants. All climbing gear provided.',
  },
];

export default function Services() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-3xl font-bold text-pine-900">Our services</h1>
      <p className="mt-2 text-stone-600">
        Every experience includes a certified guide, base liability cover and
        transport where stated.
      </p>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {services.map((s) => (
          <div key={s.name} className="rounded-xl border border-stone-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-pine-900">{s.name}</h2>
            <p className="mt-2 text-sm text-stone-600">{s.description}</p>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <dt className="text-stone-500">Duration</dt>
              <dd className="font-medium text-stone-800">{s.duration}</dd>
              <dt className="text-stone-500">Difficulty</dt>
              <dd className="font-medium text-stone-800">{s.difficulty}</dd>
              <dt className="text-stone-500">Group size</dt>
              <dd className="font-medium text-stone-800">{s.group}</dd>
            </dl>
            <p className="mt-4 font-bold text-pine-800">{s.price}</p>
            <p className="mt-1 text-xs text-stone-500">{s.notes}</p>
            <Link
              href="/booking"
              className="mt-4 inline-block rounded-lg bg-pine-700 px-4 py-2 text-sm font-semibold text-white hover:bg-pine-800"
            >
              Book now
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
