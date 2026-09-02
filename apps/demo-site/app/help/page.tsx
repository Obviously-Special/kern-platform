const faq = [
  {
    q: 'How do I change my booking?',
    a: 'Bookings can be changed free of charge up to 48 hours before the start time. Go to Account → My bookings and select "Modify booking". Changes within 48 hours are subject to availability.',
  },
  {
    q: 'What happens if the weather is bad?',
    a: 'Paragliding flights are weather-dependent. If we cancel for safety, you can rebook to any free slot or receive a full refund. Hikes and bike tours run in most conditions.',
  },
  {
    q: 'Do I need insurance?',
    a: 'Base liability cover is included in every price. Activity protection (CHF 15) adds cancellation and accident cover. Full cover (CHF 29) additionally includes equipment damage and rescue costs.',
  },
  {
    q: 'Where do the tours start?',
    a: 'All tours start at our base at Dorfstrasse 12, Grindelwald. Transport to the trailhead or launch site is included. Collection from your hotel can be arranged at the booking step.',
  },
  {
    q: 'Can I book for tomorrow?',
    a: 'Online bookings close at 18:00 the evening before. For last-minute availability, call us at +41 33 555 18 20 from 8:00.',
  },
  {
    q: 'What is the cancellation policy?',
    a: 'Free cancellation up to 72 hours before the start time. 50% refund between 72 and 24 hours. No refund within 24 hours. Full cover insurance refunds 100% at any time.',
  },
];

export default function Help() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold text-pine-900">Help & FAQ</h1>
      <p className="mt-2 text-stone-600">
        Answers to the questions we hear most often. Still stuck? Our support
        team answers within one business day.
      </p>
      <div className="mt-10 space-y-4">
        {faq.map((item) => (
          <details
            key={item.q}
            className="group rounded-xl border border-stone-200 bg-white p-6"
          >
            <summary className="cursor-pointer list-none font-semibold text-pine-900">
              {item.q}
            </summary>
            <p className="mt-3 text-sm text-stone-600">{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
