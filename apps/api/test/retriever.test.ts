import { describe, expect, it } from 'vitest';
import type { PageContext } from '@kern/contracts';
import type { KnowledgeChunk } from '../src/knowledge/types';
import { retrieve, tokenize } from '../src/knowledge/retriever';

function chunk(partial: Partial<KnowledgeChunk> & { heading: string; text: string }): KnowledgeChunk {
  return {
    id: Math.random().toString(36).slice(2),
    docId: 'test',
    url: 'http://localhost:3000/help',
    pageTypes: ['help'],
    source: 'crawl',
    ...partial,
  };
}

const pageContext = (page_type: PageContext['page_type'] = 'help', route = '/help'): PageContext => ({
  url: `http://localhost:3000${route}`,
  route,
  page_type,
  visible_text: { title: 'Help', headings: ['Help'] },
  elements: [],
  errors: [],
  entities: [],
  state_hash: 'x',
  timestamp: new Date().toISOString(),
});

describe('tokenize', () => {
  it('lowercases, strips punctuation and stopwords, keeps meaningful terms', () => {
    const terms = tokenize('What is the cancellation policy for bookings?');
    expect(terms).toContain('cancellation');
    expect(terms).toContain('policy');
    expect(terms).toContain('bookings');
    expect(terms).not.toContain('the');
    expect(terms).not.toContain('what');
  });
});

describe('retrieve', () => {
  const chunks = [
    chunk({ heading: 'Cancellation policy', text: 'Free cancellation up to 72 hours before the start time.' }),
    chunk({ heading: 'Insurance options', text: 'Activity protection: CHF 15. Full cover: CHF 29.' }),
    chunk({ heading: 'Opening hours', text: 'The base is open daily from 8:00 to 18:00.' }),
  ];

  it('ranks the chunk whose terms match the question', () => {
    const result = retrieve(chunks, 'What is the cancellation policy?', pageContext());
    expect(result[0]?.chunk.heading).toBe('Cancellation policy');
  });

  it('boosts heading hits over body-only hits', () => {
    const bodyOnly = chunk({ heading: 'General info', text: 'Cancellation rules vary.' });
    const headingHit = chunk({ heading: 'Cancellation policy', text: 'Rules apply to all bookings.' });
    const result = retrieve([bodyOnly, headingHit], 'cancellation policy', pageContext());
    expect(result[0]?.chunk.heading).toBe('Cancellation policy');
  });

  it('boosts chunks bound to the visitor page type', () => {
    const bookingBound = chunk({
      heading: 'Cancellation policy',
      text: 'Free cancellation up to 72 hours before the start time.',
      pageTypes: ['booking'],
    });
    const helpBound = chunk({
      heading: 'Cancellation policy',
      text: 'Free cancellation up to 72 hours before the start time.',
      pageTypes: ['help'],
    });
    const result = retrieve([helpBound, bookingBound], 'cancellation policy', pageContext('booking', '/booking'));
    expect(result[0]?.chunk).toBe(bookingBound);
  });

  it('falls back to page-bound knowledge when no term matches', () => {
    const result = retrieve(chunks, 'xyzzy', pageContext('booking', '/booking'));
    expect(result).toHaveLength(0); // no booking-bound chunks exist
    const withBound = [...chunks, chunk({ heading: 'Booking facts', text: 'Bookings close at 18:00.', pageTypes: ['booking'] })];
    const fallback = retrieve(withBound, 'xyzzy', pageContext('booking', '/booking'));
    expect(fallback.map((r) => r.chunk.heading)).toEqual(['Booking facts']);
  });

  it('never exceeds the given limit, including doc expansion', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      chunk({ heading: `Policy ${i}`, text: `Cancellation details for policy ${i}.` }),
    );
    expect(retrieve(many, 'cancellation', pageContext(), 4).length).toBeLessThanOrEqual(4);
    expect(retrieve(many, 'cancellation', pageContext()).length).toBeLessThanOrEqual(5);
  });

  it('REGRESSION: a term match on another page beats zero-match chunks on the current page', () => {
    // The "pricing" bug: home-bound chunks used to get a page bonus that
    // tied with a real "pricing" match on the pricing page and crowded it out.
    const homeChunks = [
      chunk({ heading: 'Certified guides', text: 'Every tour is led by a certified guide.', pageTypes: ['home'], url: 'http://localhost:3000/' }),
      chunk({ heading: 'Small groups', text: 'Maximum 8 guests per tour.', pageTypes: ['home'], url: 'http://localhost:3000/' }),
    ];
    const pricingChunk = chunk({
      heading: 'Pricing',
      text: 'Simple per-person rates for all tours and experiences.',
      pageTypes: ['pricing'],
      url: 'http://localhost:3000/pricing',
    });
    const result = retrieve([...homeChunks, pricingChunk], 'pricing', pageContext('home', '/'));
    expect(result[0]?.chunk.heading).toBe('Pricing');
    expect(result.some((r) => r.chunk.heading === 'Pricing')).toBe(true);
  });

  it('expands selected chunks with siblings from the same page', () => {
    const intro = chunk({
      heading: 'Pricing',
      text: 'Simple per-person rates for all tours.',
      pageTypes: ['pricing'],
      url: 'http://localhost:3000/pricing',
      docId: 'pricing-doc',
    });
    const row1 = chunk({
      heading: 'Eiger Panorama Hike (table row)',
      text: 'Eiger Panorama Hike | CHF 89 | CHF 159',
      pageTypes: ['pricing'],
      url: 'http://localhost:3000/pricing',
      docId: 'pricing-doc',
    });
    const row2 = chunk({
      heading: 'Tandem Paragliding (table row)',
      text: 'Tandem Paragliding | CHF 190 | CHF 240',
      pageTypes: ['pricing'],
      url: 'http://localhost:3000/pricing',
      docId: 'pricing-doc',
    });
    const result = retrieve([intro, row1, row2], 'pricing', pageContext('home', '/'));
    const headings = result.map((r) => r.chunk.heading);
    expect(headings).toContain('Pricing');
    expect(headings).toContain('Eiger Panorama Hike (table row)');
    expect(headings).toContain('Tandem Paragliding (table row)');
  });
});
