import { NextResponse } from 'next/server';

/**
 * Demo booking API — the business connector the KERN action broker calls
 * when the visitor confirms a book_appointment action (Phase 2).
 * v0: accepts the booking and returns a reference; no real inventory.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const required = ['experience', 'date', 'guests', 'name', 'email'];
  for (const field of required) {
    if (body[field] === undefined || body[field] === '') {
      return NextResponse.json({ error: `missing field: ${field}` }, { status: 400 });
    }
  }

  const bookingRef = `BK-${Math.floor(1000 + Math.random() * 9000)}`;
  return NextResponse.json({
    status: 'confirmed',
    booking_ref: bookingRef,
    booking: body,
    created_at: new Date().toISOString(),
  });
}
