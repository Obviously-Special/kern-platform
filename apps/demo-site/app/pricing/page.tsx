import Link from 'next/link';

const rows = [
  {
    experience: 'Eiger Panorama Hike',
    solo: '—',
    group: 'CHF 89',
    private: 'CHF 159',
  },
  {
    experience: 'Tandem Paragliding',
    solo: 'CHF 190',
    group: 'CHF 180',
    private: 'CHF 240',
  },
  {
    experience: 'E-Mountain Bike Tour',
    solo: '—',
    group: 'CHF 145',
    private: 'CHF 210',
  },
  {
    experience: 'Intro to Rock Climbing',
    solo: '—',
    group: 'CHF 120',
    private: 'CHF 185',
  },
];

export default function Pricing() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-3xl font-bold text-pine-900">Pricing</h1>
      <p className="mt-2 max-w-2xl text-stone-600">
        Simple per-person rates. Group prices apply for 2–8 guests on the same
        booking; private tours mean the day is yours alone.
      </p>

      <div className="mt-10 overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr>
              <th className="px-6 py-4 font-semibold text-stone-700">Experience</th>
              <th className="px-6 py-4 font-semibold text-stone-700">Solo</th>
              <th className="px-6 py-4 font-semibold text-stone-700">Group (2–8)</th>
              <th className="px-6 py-4 font-semibold text-stone-700">Private</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.experience} className="border-b border-stone-100 last:border-0">
                <td className="px-6 py-4 font-medium text-stone-800">{r.experience}</td>
                <td className="px-6 py-4 text-stone-600">{r.solo}</td>
                <td className="px-6 py-4 text-stone-600">{r.group}</td>
                <td className="px-6 py-4 text-stone-600">{r.private}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 space-y-1 text-xs text-stone-500">
        <p>
          * Weekend departures (Saturday & Sunday) carry a 15% peak-season surcharge.
        </p>
        <p>
          * Paragliding prices include the base liability cover required by Swiss law.
        </p>
        <p>* Prices do not include optional equipment rental or extended insurance cover.</p>
      </div>

      <div className="mt-10 flex gap-4">
        <Link
          href="/booking"
          className="rounded-lg bg-pine-700 px-6 py-3 font-semibold text-white hover:bg-pine-800"
        >
          Start a booking
        </Link>
        <Link
          href="/help"
          className="rounded-lg border border-stone-300 px-6 py-3 font-semibold text-stone-700 hover:bg-white"
        >
          Questions? Read the FAQ
        </Link>
      </div>
    </div>
  );
}
