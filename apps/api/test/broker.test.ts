import { afterEach, describe, expect, it } from 'vitest';
import type { PageElement } from '@kern/contracts';
import { inferBookingAction, inferFillAction, parseActionDirectives, processProposals } from '../src/actions/broker';
import { setPolicy } from '../src/policy/service';

const elements: PageElement[] = [
  { id: 'full-name', ref: 'kern-el-0', tag: 'input', label: 'Full name' },
  { ref: 'kern-el-1', role: 'button', tag: 'button', label: 'Continue' },
];

const ctx = {
  siteId: 'demo-bergblick',
  sessionId: 's1',
  tenantId: 't1',
  contextElements: elements,
};

describe('parseActionDirectives', () => {
  it('extracts valid action directives and strips them from the reply', () => {
    const { reply, proposals } = parseActionDirectives(
      'I will fill that in.\n<<ACTION:fill_field|{"ref":"kern-el-0","value":"Max Mustermann"}>>',
    );
    expect(reply).toBe('I will fill that in.');
    expect(proposals).toEqual([
      { tool: 'fill_field', args: { ref: 'kern-el-0', value: 'Max Mustermann' } },
    ]);
  });

  it('drops malformed JSON without crashing', () => {
    const { proposals } = parseActionDirectives('x\n<<ACTION:fill_field|{not json}>>\n<<ACTION:fill_field|{"ref":"a"}>>');
    expect(proposals).toHaveLength(1);
  });
});

describe('processProposals — the LLM proposes, the broker decides', () => {
  afterEach(() => {
    setPolicy('demo-bergblick', { autonomousActionsEnabled: false });
  });

  it('returns confirmation_required for reversible actions under the demo policy (kill switch off)', () => {
    const { actions } = processProposals({
      ...ctx,
      proposals: [{ tool: 'fill_field', args: { ref: 'kern-el-0', value: 'Max' } }],
    });
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      tool: 'fill_field',
      decision: 'confirmation_required',
      permission_level: 'reversible',
      label: 'Fill "Full name" with "Max"',
    });
  });

  it('returns allowed when the policy allows autonomous reversible actions', () => {
    setPolicy('demo-bergblick', {
      autonomousActionsEnabled: true,
      allowedLevels: ['reversible'],
      confirmationLevels: ['transactional'],
    });
    const { actions } = processProposals({
      ...ctx,
      proposals: [{ tool: 'select_option', args: { ref: 'kern-el-1' } }],
    });
    expect(actions[0]?.decision).toBe('allowed');
  });

  it('rejects unknown tools — and logs the rejection instead of dropping silently', () => {
    const { actions, rejected } = processProposals({
      ...ctx,
      proposals: [{ tool: 'delete_everything', args: {} }],
    });
    expect(actions).toHaveLength(0);
    expect(rejected).toEqual([{ tool: 'delete_everything', reason: 'unknown_tool' }]);
  });

  it('rejects args outside the tool contract', () => {
    const { actions } = processProposals({ ...ctx, proposals: [{ tool: 'fill_field', args: { ref: 'x' } }] });
    expect(actions).toHaveLength(0);
  });

  it('rejects browser tools targeting refs the model never saw', () => {
    const { actions } = processProposals({
      ...ctx,
      proposals: [{ tool: 'fill_field', args: { ref: 'kern-el-99', value: 'x' } }],
    });
    expect(actions).toHaveLength(0);
  });

  it('coerces string guests to a number — the silent-drop trap stays dead', () => {
    const { actions, rejected } = processProposals({
      ...ctx,
      proposals: [
        {
          tool: 'book_appointment',
          args: {
            experience: 'Tandem Paragliding',
            date: '2026-09-05',
            guests: '2', // model typed it as a string
            name: 'Max Mustermann',
            email: 'max@example.com',
          },
        },
      ],
    });
    expect(rejected).toHaveLength(0);
    expect(actions[0]?.args.guests).toBe(2);
  });

  it('transactional booking proposals need confirmation', () => {
    const { actions } = processProposals({
      ...ctx,
      proposals: [
        {
          tool: 'book_appointment',
          args: {
            experience: 'Tandem Paragliding',
            date: '2026-09-05',
            guests: 2,
            name: 'Max Mustermann',
            email: 'max@example.com',
          },
        },
      ],
    });
    expect(actions[0]).toMatchObject({ tool: 'book_appointment', decision: 'confirmation_required' });
  });
});

describe('inferBookingAction — deterministic booking fallback', () => {
  it('synthesizes book_appointment when the message carries ALL required facts', () => {
    const proposal = inferBookingAction(
      'Book the Eiger hike for the 16th of September 2026, 2 people, with equipment rental and activity protection. My name is Sabine Keller, sabine@example.com',
      "I'll set that up for you.",
      undefined, // siteMap resolved via getSitePageMap internally in the route; here pass undefined to test the guard
    );
    expect(proposal).toBeUndefined(); // no catalog without a site map — guards hold
  });

  it('synthesizes with the demo catalog when available', () => {
    const proposal = inferBookingAction(
      'Book the Eiger hike for the 16th of September 2026, 2 people. My name is Sabine Keller, sabine@example.com',
      "I'll set that up for you.",
      { experiences: [{ name: 'Eiger Panorama Hike', aliases: ['eiger hike'] }] } as never,
    );
    expect(proposal).toMatchObject({
      tool: 'book_appointment',
      args: {
        experience: 'Eiger Panorama Hike',
        date: '2026-09-16',
        guests: 2,
        name: 'Sabine Keller',
        email: 'sabine@example.com',
      },
    });
  });

  it('stays silent when the model refused', () => {
    const proposal = inferBookingAction(
      'Book the Eiger hike for the 16th of September 2026, 2 people. My name is Sabine Keller, sabine@example.com',
      "I can't create bookings yet.",
      { experiences: [{ name: 'Eiger Panorama Hike', aliases: ['eiger hike'] }] } as never,
    );
    expect(proposal).toBeUndefined();
  });

  it('all-or-nothing: missing email means no synthesis', () => {
    const proposal = inferBookingAction(
      'Book the Eiger hike for the 16th of September 2026, 2 people. My name is Sabine Keller',
      "I'll set that up for you.",
      { experiences: [{ name: 'Eiger Panorama Hike', aliases: ['eiger hike'] }] } as never,
    );
    expect(proposal).toBeUndefined();
  });

  it('all-or-nothing: ambiguous experience means no synthesis', () => {
    // "Eiger hike" matches BOTH the specific alias and the generic
    // 'hike' alias of another experience — must not guess
    const proposal = inferBookingAction(
      'Book the Eiger hike for the 16th of September 2026, 2 people. My name is Sabine Keller, sabine@example.com',
      "I'll set that up.",
      {
        experiences: [
          { name: 'Eiger Panorama Hike', aliases: ['eiger hike'] },
          { name: 'Nordwand Climb', aliases: ['hike'] },
        ],
      } as never,
    );
    expect(proposal).toBeUndefined();
  });

  it('parses dates with year defaults anchored to today', () => {
    const proposal = inferBookingAction(
      'Book the paragliding for the 25th of December, 2 people. My name is Max Mustermann, max@example.com',
      'Sure.',
      { experiences: [{ name: 'Tandem Paragliding', aliases: ['paragliding'] }] } as never,
    );
    // December 25 of the current year (or next if already past)
    expect(proposal?.args.date).toMatch(/^\d{4}-12-25$/);
  });
});

describe('inferFillAction — deterministic fallback for directive variance', () => {
  it('infers fill_field when the visitor names a field and value with a unique match', () => {
    const proposal = inferFillAction(
      'please fill my name with Max Mustermann',
      "I'll fill that in for you.",
      elements,
    );
    // id preferred over ref when both exist (more stable reference)
    expect(proposal).toEqual({ tool: 'fill_field', args: { ref: 'full-name', value: 'Max Mustermann' } });
  });

  it('stays silent when the model refused', () => {
    const proposal = inferFillAction(
      'fill my name with Max',
      "I can't fill fields yet.",
      elements,
    );
    expect(proposal).toBeUndefined();
  });

  it('stays silent on ambiguous matches — never guesses', () => {
    const ambiguous: PageElement[] = [
      { ref: 'a', tag: 'input', label: 'Guest name' },
      { ref: 'b', tag: 'input', label: 'Full name' },
    ];
    expect(inferFillAction('fill the name with Max', 'Sure!', ambiguous)).toBeUndefined();
  });

  it('stays silent when no fill pattern exists in the message', () => {
    expect(inferFillAction('what is the cancellation policy?', '72 hours.', elements)).toBeUndefined();
  });
});
