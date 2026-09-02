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

  it('respects the chunk limit', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      chunk({ heading: `Policy ${i}`, text: `Cancellation details for policy ${i}.` }),
    );
    expect(retrieve(many, 'cancellation', pageContext())).toHaveLength(4);
  });
});
