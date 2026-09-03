import { afterEach, describe, expect, it } from 'vitest';
import type { PageElement } from '@kern/contracts';
import { inferFillAction, parseActionDirectives, processProposals } from '../src/actions/broker';
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
    const actions = processProposals({
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
    const actions = processProposals({
      ...ctx,
      proposals: [{ tool: 'select_option', args: { ref: 'kern-el-1' } }],
    });
    expect(actions[0]?.decision).toBe('allowed');
  });

  it('drops unknown tools', () => {
    const actions = processProposals({ ...ctx, proposals: [{ tool: 'delete_everything', args: {} }] });
    expect(actions).toHaveLength(0);
  });

  it('drops args outside the tool contract', () => {
    const actions = processProposals({ ...ctx, proposals: [{ tool: 'fill_field', args: { ref: 'x' } }] });
    expect(actions).toHaveLength(0);
  });

  it('drops browser tools targeting refs the model never saw', () => {
    const actions = processProposals({
      ...ctx,
      proposals: [{ tool: 'fill_field', args: { ref: 'kern-el-99', value: 'x' } }],
    });
    expect(actions).toHaveLength(0);
  });

  it('transactional booking proposals need confirmation', () => {
    const actions = processProposals({
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
