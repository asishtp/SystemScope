import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  blastRadius,
  compareLabel,
  contextIds,
  coverageBand,
  coveragePercent,
  defaultToBeDisposition,
  deriveEstateStatus,
  focusViewport,
  graphNeighbours,
  isolateShown,
  neighbourhood,
  matchCatalogToRegistered,
  pinSummary,
  queryHits,
  reportRows,
} from './assessment.ts';

const edges = [
  { from: 'wms', to: 'ats', label: 'Title API' },
  { from: 'ats', to: 'wms', label: 'Billing CSV' },
  { from: 'wms', to: 'hydstra', label: 'Feeds' },
  { from: 'hydstra', to: 'wmip' },
  { from: 'hydstra', to: 'my-groundwater' },
  { from: 'gauges', to: 'hydstra' },
  { from: 'wateriq', to: 'ats' },
];

const catalog = [
  { id: 'wms', name: 'Water Management System', acronym: 'WMS' },
  { id: 'ats', name: 'Automated Titling System', acronym: 'ATS' },
  { id: 'hydstra', name: 'Water Monitoring Information System — Hydstra', acronym: 'WMS-Hydstra', decommissioned: false },
  { id: 'wmip', name: 'Water Monitoring Information Portal', acronym: 'WMIP' },
  { id: 'my-groundwater', name: 'My Groundwater Monitoring', acronym: 'My GW' },
  { id: 'gauges', name: 'Water Gauges & Ground Stations', acronym: 'Gauges' },
  { id: 'wateriq', name: 'WaterIQ Manager', acronym: 'WaterIQ' },
  { id: 'ciram', name: 'Compliance Information Register and Management', acronym: 'CIRaM', decommissioned: true },
];

describe('landscape assessment logic', () => {
  it('matches catalog systems to registered records by acronym or name', () => {
    const registered = [{ id: 'reg-1', projectId: 'p1', name: 'Water Management System', acronym: 'WMS' }];
    const hit = matchCatalogToRegistered(catalog[0], registered);
    assert.equal(hit?.id, 'reg-1');
    assert.equal(matchCatalogToRegistered(catalog[1], registered), undefined);
  });

  it('derives box status, coverage band, pins and confirmation from registers', () => {
    const wmsId = 'sys-wms';
    const facts = {
      systems: [{ id: wmsId, projectId: 'p1', name: 'Water Management System', acronym: 'WMS' }],
      assessments: [{
        systemId: wmsId,
        status: 'InProgress',
        responses: [
          { mandatory: true, answered: true, status: 'Answered', confidence: 'ConfirmedBySme' },
          { mandatory: true, answered: false, status: 'Unknown', confidence: 'Unconfirmed' },
          { mandatory: true, answered: false, status: 'Draft', confidence: 'Unconfirmed' },
          { mandatory: false, answered: false, status: 'Draft', confidence: 'Unconfirmed' },
        ],
      }],
      findings: [
        { systemId: wmsId, type: 'Risk', severity: 'High' },
        { systemId: wmsId, type: 'InformationGap', severity: 'Moderate' },
      ],
      actions: [
        { systemId: wmsId, status: 'Open', dueDate: '2020-01-01' },
        { systemId: wmsId, status: 'Completed', dueDate: '2020-01-01' },
      ],
      evidence: [{ systemId: wmsId, title: 'Architecture pack', validated: true, updatedAt: '2025-04-01T00:00:00Z', source: 'SME + architecture pack' }],
    };
    const estate = deriveEstateStatus(catalog, facts, edges, new Date('2026-08-19'));
    const wms = estate.find(s => s.catalogId === 'wms')!;
    const hydstra = estate.find(s => s.catalogId === 'hydstra')!;
    assert.equal(wms.inScope, true);
    assert.equal(wms.lifecycle, 'in-workshop');
    assert.equal(wms.coveragePercent, 67);
    assert.equal(wms.coverage, 'red');
    assert.equal(wms.highCriticalFindings, 1);
    assert.equal(wms.informationGaps, 2);
    assert.equal(pinSummary(wms), '1 high · 2 gap · 1 overdue');
    assert.equal(pinSummary({ findingCount: 0, highCriticalFindings: 0, informationGaps: 3, overdueActions: 0 }), '3 gap');
    assert.equal(wms.findingCount, 2);
    assert.equal(wms.overdueActions, 1);
    assert.equal(wms.lastConfirmed?.source, 'SME + architecture pack');
    assert.equal(wms.unconfirmed, false);
    assert.equal(hydstra.inScope, false);
    assert.equal(hydstra.context, true);
    assert.equal(hydstra.lifecycle, 'not-in-scope');
    assert.equal(coverageBand(90, 0), 'green');
    assert.equal(coverageBand(60, 0), 'amber');
    assert.equal(coverageBand(20, 0), 'red');
    assert.equal(coverageBand(-1, 0), 'none');
    assert.equal(coveragePercent(facts.assessments[0].responses), 67);
  });

  it('computes blast-radius dependents from the same link graph', () => {
    const fromHydstra = blastRadius('hydstra', edges);
    assert.deepEqual(fromHydstra.sort(), ['my-groundwater', 'wmip']);
    const fromWms = blastRadius('wms', edges);
    assert.ok(fromWms.includes('ats'));
    assert.ok(fromWms.includes('hydstra'));
    assert.ok(fromWms.includes('wmip'));
    assert.ok(!fromWms.includes('gauges'));
    const oneHop = neighbourhood('hydstra', edges, 1);
    assert.ok(oneHop.has('gauges') && oneHop.has('wmip') && !oneHop.has('wateriq'));
    const twoHop = neighbourhood('wms', edges, 2);
    assert.ok(twoHop.has('wmip'));
    assert.ok(!twoHop.has('wateriq') || twoHop.has('ats'));
    const related = graphNeighbours('hydstra', edges).related;
    assert.ok(related.has('gauges'));
    assert.ok(related.has('wmip'));
    assert.ok(related.has('hydstra'));
  });

  it('isolates search and filter hits instead of leaving the full estate visible', () => {
    const ids = catalog.map(c => c.id);
    const hits = queryHits(catalog, 'hydstra');
    assert.deepEqual([...hits], ['hydstra']);
    const isolated = isolateShown(ids, { queryHits: hits, edges, includeContext: false });
    assert.deepEqual([...isolated], ['hydstra']);
    const withContext = isolateShown(ids, { queryHits: hits, edges, includeContext: true });
    assert.ok(withContext.has('hydstra'));
    assert.ok(withContext.has('wmip'));
    assert.ok(withContext.has('gauges'));
    assert.ok(!withContext.has('wateriq'));
    const filtered = isolateShown(ids, { filterHits: new Set(['wms', 'ats', 'wateriq']) });
    assert.deepEqual([...filtered].sort(), ['ats', 'wateriq', 'wms']);
  });

  it('labels as-is vs to-be compare dispositions', () => {
    const asIs = new Set(catalog.map(c => c.id));
    const toBe = [
      { id: 'wms', disposition: 'keep' as const },
      { id: 'wateriq', disposition: 'keep' as const },
      { id: 'ciram', disposition: 'retire' as const },
      { id: 'hydstra', disposition: 'replace' as const },
      { id: 'target-platform', disposition: 'add' as const },
    ];
    assert.equal(compareLabel('wms', asIs, toBe), 'keep');
    assert.equal(compareLabel('ciram', asIs, toBe), 'retire');
    assert.equal(compareLabel('hydstra', asIs, toBe), 'replace');
    assert.equal(compareLabel('target-platform', asIs, toBe), 'add');
    assert.equal(compareLabel('gauges', asIs, []), 'retire');
    assert.equal(defaultToBeDisposition('ciram', true), 'retire');
    assert.equal(defaultToBeDisposition('wateriq'), 'keep');
  });

  it('marks in-scope vs one-hop context from project membership and links', () => {
    const ctx = contextIds(['wms'], edges);
    assert.ok(ctx.has('ats'));
    assert.ok(ctx.has('hydstra'));
    assert.ok(!ctx.has('wms'));
    assert.ok(!ctx.has('wmip'));
  });

  it('centres the viewport on search hits and fits every box', () => {
    const boxes = [
      { x: 100, y: 80, w: 200, h: 80 },
      { x: 1600, y: 900, w: 200, h: 80 },
    ];
    const fit = focusViewport(boxes, { width: 1200, height: 700 }, 40);
    assert.ok(fit.zoom < 1);
    assert.ok(fit.bounds && fit.bounds.minX === 100 && fit.bounds.maxX === 1800);
    const hydstraBox = [{ x: 1304, y: 460, w: 456, h: 88 }];
    const centred = focusViewport(hydstraBox, { width: 1000, height: 600 });
    const cx = 1304 + 456 / 2;
    assert.ok(Math.abs(centred.pan.x - (1000 / 2 - cx * centred.zoom)) < 0.01);
  });

  it('builds a print report of in-scope systems, interfaces and findings', () => {
    const facts = {
      systems: [{ id: 'sys-wms', projectId: 'p1', name: 'Water Management System', acronym: 'WMS' }],
      assessments: [{ systemId: 'sys-wms', status: 'Submitted', responses: [{ mandatory: true, answered: true, status: 'Answered', confidence: 'ConfirmedByEvidence' }] }],
      findings: [{ systemId: 'sys-wms', type: 'Risk', severity: 'Critical' }],
      actions: [],
      evidence: [],
    };
    const statuses = deriveEstateStatus(catalog, facts, edges);
    const rows = reportRows(catalog, statuses, edges, facts.findings);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].acronym, 'WMS');
    assert.ok(rows[0].interfaces.some(i => i.includes('wms→ats')));
    assert.deepEqual(rows[0].findings, ['Critical Risk']);
  });
});
