'use client';

import { useState } from 'react';

/**
 * The demo booking flow — deliberately friction-rich (see KERN_Master_Timeline:
 * the site is the eval testbed). Known friction points:
 *  1. Weekend surcharge is not shown until the review step (sticker shock)
 *  2. Minimum group size produces a visible validation error at step 2
 *  3. Insurance options are confusingly similar, required, no default → error
 *  4. "Collection point arrangement" — vague wording for hotel pickup
 *  5. Cancellation policy only visible as small print on the review step
 */

const experiences = [
  { id: 'hike-eiger', name: 'Eiger Panorama Hike', price: 89, minGuests: 2 },
  { id: 'paragliding', name: 'Tandem Paragliding', price: 190, minGuests: 1 },
  { id: 'bike-tour', name: 'E-Mountain Bike Tour', price: 145, minGuests: 2 },
  { id: 'climbing', name: 'Intro to Rock Climbing', price: 120, minGuests: 2 },
];

const insuranceOptions = [
  { id: 'activity', name: 'Activity protection', price: 15, desc: 'Covers you during the activity.' },
  { id: 'full', name: 'Full cover', price: 29, desc: 'Extends your cover during the activity.' },
];

type WizardState = {
  step: number;
  experience: string | null;
  date: string | null;
  guests: number;
  extras: string[];
  insurance: string | null;
  name: string;
  email: string;
  phone: string;
  errors: string[];
};

const initialState: WizardState = {
  step: 1,
  experience: null,
  date: null,
  guests: 1,
  extras: [],
  insurance: null,
  name: '',
  email: '',
  phone: '',
  errors: [],
};

function nextTwoWeeks(): { iso: string; label: string; weekday: string; disabled: boolean; weekend: boolean }[] {
  const days = [];
  const today = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    days.push({
      iso: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-CH', { day: 'numeric', month: 'short' }),
      weekday: d.toLocaleDateString('en-CH', { weekday: 'short' }),
      // Every 4th day is "fully booked" — people ask why they can't pick it
      disabled: i % 4 === 0,
      weekend,
    });
  }
  return days;
}

export default function BookingWizard() {
  const [s, setS] = useState<WizardState>(initialState);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  const days = nextTwoWeeks();
  const exp = experiences.find((e) => e.id === s.experience);

  const weekendSelected = s.date && days.find((d) => d.iso === s.date)?.weekend;
  const surcharge = weekendSelected && exp ? Math.round(exp.price * 0.15) : 0;
  const insurancePrice = insuranceOptions.find((o) => o.id === s.insurance)?.price ?? 0;
  const extrasPrice = s.extras.includes('equipment') ? 40 : 0;
  const total = exp ? exp.price * s.guests + surcharge * s.guests + insurancePrice * s.guests + extrasPrice : 0;

  function fail(...errors: string[]) {
    setS({ ...s, errors });
  }

  function next(step: number) {
    if (step === 2 && !s.experience) return fail('Please choose an experience to continue.');
    if (step === 3 && !s.date) return fail('Please select a date for your adventure.');
    if (step === 3 && exp && s.guests < exp.minGuests)
      return fail(`This experience requires at least ${exp.minGuests} participants.`);
    if (step === 4 && !s.insurance) return fail('Please select an insurance option to continue.');
    if (step === 5) {
      if (!s.name) return fail('Please enter your full name.');
      if (!s.email) return fail('Please enter your email address.');
    }
    setS({ ...s, step, errors: [] });
    window.scrollTo({ top: 0 });
  }

  function confirmBooking() {
    const ref = `BK-${Math.floor(1000 + Math.random() * 9000)}`;
    setConfirmed(ref);
    window.scrollTo({ top: 0 });
  }

  if (confirmed) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-10 text-center">
        <h2 className="text-2xl font-bold text-pine-900">Your adventure is booked! 🏔️</h2>
        <p className="mt-3 text-stone-600">
          Booking reference <span className="font-semibold text-pine-800">{confirmed}</span>
        </p>
        <p className="mt-2 text-sm text-stone-500">
          A confirmation email is on its way. You can manage this booking under Account → My bookings.
        </p>
        <p className="mt-6 text-xs text-stone-400">
          Free cancellation up to 72 hours before the start time. Full cover insurance refunds 100% at any time.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6 md:p-8">
      {/* Step indicator — data-kern-step-list + aria-current="step" is the
          accessible markup the KERN page map detects (demo of good-citizen
          integration) */}
      <ol data-kern-step-list className="mb-8 flex flex-wrap gap-2 text-xs font-semibold text-stone-500">
        {['Experience', 'Date & group', 'Extras', 'Insurance', 'Your details', 'Review'].map(
          (label, i) => (
            <li
              key={label}
              aria-current={s.step === i + 1 ? 'step' : undefined}
              className={
                s.step === i + 1
                  ? 'rounded-full bg-pine-700 px-3 py-1 text-white'
                  : 'rounded-full bg-stone-100 px-3 py-1'
              }
            >
              {i + 1}. {label}
            </li>
          ),
        )}
      </ol>

      {/* Errors */}
      {s.errors.length > 0 && (
        <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {s.errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}

      {/* Step 1 — experience */}
      {s.step === 1 && (
        <fieldset>
          <legend className="text-lg font-semibold text-pine-900">Choose your experience</legend>
          <div className="mt-4 space-y-3">
            {experiences.map((e) => (
              <label
                key={e.id}
                className={`flex cursor-pointer items-center justify-between rounded-lg border p-4 ${
                  s.experience === e.id ? 'border-pine-600 bg-pine-50' : 'border-stone-200'
                }`}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="experience"
                    className="h-4 w-4 accent-pine-700"
                    checked={s.experience === e.id}
                    onChange={() => setS({ ...s, experience: e.id })}
                  />
                  <span className="font-medium text-stone-800">{e.name}</span>
                </span>
                <span className="font-bold text-pine-800">CHF {e.price}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {/* Step 2 — date & group */}
      {s.step === 2 && (
        <div>
          <h2 className="text-lg font-semibold text-pine-900">Pick a date</h2>
          <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
            {days.map((d) => (
              <button
                key={d.iso}
                type="button"
                id={`date-${d.iso}`}
                aria-label={`Book ${d.label}`}
                disabled={d.disabled}
                onClick={() => setS({ ...s, date: d.iso })}
                className={`rounded-lg border p-3 text-center text-sm ${
                  d.disabled
                    ? 'cursor-not-allowed border-stone-100 bg-stone-50 text-stone-300'
                    : s.date === d.iso
                      ? 'border-pine-600 bg-pine-700 text-white'
                      : 'border-stone-200 text-stone-700 hover:border-pine-500'
                }`}
              >
                <span className="block font-semibold">{d.weekday}</span>
                <span className="block text-xs opacity-80">{d.label}</span>
                {d.disabled && <span className="block text-[10px]">Full</span>}
              </button>
            ))}
          </div>
          <label htmlFor="guests" className="mt-6 block text-sm font-semibold text-stone-700">
            Number of guests
          </label>
          <input
            id="guests"
            type="number"
            min={1}
            max={8}
            value={s.guests}
            onChange={(e) => setS({ ...s, guests: Number(e.target.value) })}
            className="mt-2 w-32 rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>
      )}

      {/* Step 3 — extras */}
      {s.step === 3 && (
        <fieldset>
          <legend className="text-lg font-semibold text-pine-900">Extras</legend>
          <div className="mt-4 space-y-3">
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-stone-200 p-4">
              <input
                type="checkbox"
                className="h-4 w-4 accent-pine-700"
                checked={s.extras.includes('equipment')}
                onChange={(e) =>
                  setS({
                    ...s,
                    extras: e.target.checked ? [...s.extras, 'equipment'] : s.extras.filter((x) => x !== 'equipment'),
                  })
                }
              />
              <span>
                <span className="block font-medium text-stone-800">Equipment rental — CHF 40</span>
                <span className="text-xs text-stone-500">Bike, helmet or climbing gear depending on experience</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-stone-200 p-4">
              <input
                type="checkbox"
                className="h-4 w-4 accent-pine-700"
                checked={s.extras.includes('collection')}
                onChange={(e) =>
                  setS({
                    ...s,
                    extras: e.target.checked ? [...s.extras, 'collection'] : s.extras.filter((x) => x !== 'collection'),
                  })
                }
              />
              <span>
                <span className="block font-medium text-stone-800">Collection point arrangement — free</span>
                <span className="text-xs text-stone-500">We arrange the meeting point for your group</span>
              </span>
            </label>
          </div>
        </fieldset>
      )}

      {/* Step 4 — insurance (the deliberate friction point) */}
      {s.step === 4 && (
        <fieldset>
          <legend className="text-lg font-semibold text-pine-900">Insurance</legend>
          <p className="mt-1 text-sm text-stone-500">Please select an option to continue.</p>
          <div className="mt-4 space-y-3">
            {insuranceOptions.map((o) => (
              <label
                key={o.id}
                className={`flex cursor-pointer items-center justify-between rounded-lg border p-4 ${
                  s.insurance === o.id ? 'border-pine-600 bg-pine-50' : 'border-stone-200'
                }`}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="insurance"
                    className="h-4 w-4 accent-pine-700"
                    checked={s.insurance === o.id}
                    onChange={() => setS({ ...s, insurance: o.id })}
                  />
                  <span>
                    <span className="font-medium text-stone-800">{o.name}</span>
                    <span className="block text-xs text-stone-500">{o.desc}</span>
                  </span>
                </span>
                <span className="font-bold text-pine-800">CHF {o.price}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {/* Step 5 — details */}
      {s.step === 5 && (
        <div>
          <h2 className="text-lg font-semibold text-pine-900">Your details</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-stone-700">
                Full name
              </label>
              <input
                id="name"
                type="text"
                value={s.name}
                onChange={(e) => setS({ ...s, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-stone-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={s.email}
                onChange={(e) => setS({ ...s, email: e.target.value })}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-semibold text-stone-700">
                Phone (optional)
              </label>
              <input
                id="phone"
                type="tel"
                value={s.phone}
                onChange={(e) => setS({ ...s, phone: e.target.value })}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 6 — review */}
      {s.step === 6 && exp && (
        <div>
          <h2 className="text-lg font-semibold text-pine-900">Review your booking</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-600">Experience</dt>
              <dd className="font-medium text-stone-800">{exp.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-600">Date</dt>
              <dd className="font-medium text-stone-800">
                {s.date} {weekendSelected && <span className="text-amber-700">(weekend)</span>}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-600">Guests</dt>
              <dd className="font-medium text-stone-800">{s.guests}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-600">Base price</dt>
              <dd className="font-medium text-stone-800">CHF {exp.price * s.guests}</dd>
            </div>
            {weekendSelected && (
              <div className="flex justify-between text-amber-800">
                <dt>Weekend surcharge (15%)</dt>
                <dd>+ CHF {surcharge * s.guests}</dd>
              </div>
            )}
            {s.extras.includes('equipment') && (
              <div className="flex justify-between">
                <dt className="text-stone-600">Equipment rental</dt>
                <dd className="font-medium text-stone-800">+ CHF {40 * s.guests}</dd>
              </div>
            )}
            {s.insurance && (
              <div className="flex justify-between">
                <dt className="text-stone-600">Insurance</dt>
                <dd className="font-medium text-stone-800">+ CHF {insurancePrice * s.guests}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-stone-200 pt-2 text-base font-bold text-pine-900">
              <dt>Total</dt>
              <dd>CHF {total}</dd>
            </div>
          </dl>
          <p className="mt-6 text-[11px] leading-relaxed text-stone-400">
            By confirming you accept our Terms & Conditions. Cancellation policy: free up to 72 hours
            before the start time, 50% between 72 and 24 hours, no refund within 24 hours. Full cover
            insurance refunds 100% at any time. Weekend departures carry a 15% peak-season surcharge.
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-8 flex justify-between">
        {s.step > 1 ? (
          <button
            type="button"
            onClick={() => setS({ ...s, step: s.step - 1, errors: [] })}
            className="rounded-lg border border-stone-300 px-5 py-2.5 font-semibold text-stone-700 hover:bg-stone-50"
          >
            Back
          </button>
        ) : (
          <span />
        )}
        {s.step < 6 ? (
          <button
            type="button"
            id="booking-continue"
            onClick={() => next(s.step + 1)}
            className="rounded-lg bg-pine-700 px-6 py-2.5 font-semibold text-white hover:bg-pine-800"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            id="booking-confirm"
            onClick={confirmBooking}
            className="rounded-lg bg-sun-500 px-6 py-2.5 font-semibold text-pine-900 hover:bg-sun-400"
          >
            Confirm booking · CHF {total}
          </button>
        )}
      </div>
    </div>
  );
}
