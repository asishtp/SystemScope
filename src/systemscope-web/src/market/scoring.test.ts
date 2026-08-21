import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { openGap, readinessLabel } from './types.ts';

const weights = [
  ['Architecture', 20],
  ['Database', 15],
  ['Infrastructure', 10],
  ['Integrations', 15],
  ['DataQuality', 10],
  ['Security', 10],
  ['Operations', 10],
  ['Limitations', 10],
] as const;

function informationScore(domains: { kind: string; completeness: number; requirement: string }[]) {
  let weighted = 0;
  let total = 0;
  for (const [kind, weight] of weights) {
    const domain = domains.find(d => d.kind === kind);
    if (!domain || domain.requirement === 'Deferred') continue;
    weighted += domain.completeness * weight;
    total += weight;
  }
  return total === 0 ? 0 : Math.round(weighted / total);
}

describe('market-scan scoring', () => {
  it('weights the market-scan domains to 100%', () => {
    assert.equal(weights.reduce((sum, [, w]) => sum + w, 0), 100);
  });

  it('does not penalise deferred or not-applicable domains', () => {
    const score = informationScore([
      { kind: 'Architecture', completeness: 35, requirement: 'Required' },
      { kind: 'Database', completeness: 20, requirement: 'Required' },
      { kind: 'Infrastructure', completeness: 5, requirement: 'Required' },
      { kind: 'Integrations', completeness: 10, requirement: 'Required' },
      { kind: 'DataQuality', completeness: 0, requirement: 'Required' },
      { kind: 'Security', completeness: 0, requirement: 'Deferred' },
      { kind: 'Operations', completeness: 0, requirement: 'Required' },
      { kind: 'Limitations', completeness: 0, requirement: 'Required' },
    ]);
    assert.equal(score, 13);
  });

  it('treats only live gap statuses as open', () => {
    assert.equal(openGap('Open'), true);
    assert.equal(openGap('DeferredByScope'), false);
    assert.equal(openGap('NotApplicable'), false);
    assert.equal(openGap('Resolved'), false);
  });

  it('labels document readiness below the publication threshold', () => {
    assert.equal(readinessLabel(22), 'Not ready');
    assert.equal(readinessLabel(80), 'Ready');
  });
});
