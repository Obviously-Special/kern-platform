const bookings = [
  {
    ref: 'BK-2409',
    name: 'Eiger Panorama Hike',
    date: 'Sat, 12 Sep 2026 · 9:00',
    guests: 2,
    status: 'Confirmed',
    total: 'CHF 204.70',
  },
  {
    ref: 'BK-2387',
    name: 'Tandem Paragliding',
    date: 'Thu, 3 Sep 2026 · 14:00',
    guests: 1,
    status: 'Completed',
    total: 'CHF 190.00',
  },
];

export default function Account() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-3xl font-bold text-pine-900">My account</h1>
      <p className="mt-2 text-stone-600">
        Signed in as <span className="font-medium text-stone-800">s.keller@example.com</span>
      </p>

      <h2 className="mt-10 text-xl font-semibold text-pine-900">My bookings</h2>
      <div className="mt-4 space-y-4">
        {bookings.map((b) => (
          <div
            key={b.ref}
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-6"
          >
            <div>
              <p className="font-semibold text-pine-900">
                {b.name}{' '}
                <span className="ml-1 text-xs font-normal text-stone-400">{b.ref}</span>
              </p>
              <p className="mt-1 text-sm text-stone-600">{b.date}</p>
              <p className="text-sm text-stone-500">{b.guests} guest{b.guests > 1 ? 's' : ''}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-pine-800">{b.total}</p>
              <span
                className={
                  b.status === 'Confirmed'
                    ? 'mt-1 inline-block rounded-full bg-pine-100 px-3 py-1 text-xs font-semibold text-pine-700'
                    : 'mt-1 inline-block rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600'
                }
              >
                {b.status}
              </span>
            </div>
            {b.status === 'Confirmed' && (
              <button className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50">
                Modify booking
              </button>
            )}
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-xl font-semibold text-pine-900">Billing details</h2>
      <div className="mt-4 rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-600">
        <p>Sabine Keller</p>
        <p>Bahnhofstrasse 31, 8001 Zürich</p>
        <p>Visa ending in 4482</p>
        <button className="mt-4 rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50">
          Update billing details
        </button>
      </div>
    </div>
  );
}
