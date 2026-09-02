import BookingWizard from '@/components/BookingWizard';

export const metadata = {
  title: 'Book your adventure — Bergblick Adventures',
};

export default function BookingPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold text-pine-900">Book your adventure</h1>
      <p className="mt-2 text-stone-600">
        Online bookings close at 18:00 the evening before your start date.
      </p>
      <div className="mt-8">
        <BookingWizard />
      </div>
    </div>
  );
}
