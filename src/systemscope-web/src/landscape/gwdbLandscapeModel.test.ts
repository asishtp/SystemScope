import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import schema from '../schema/gwdb-schema.json';
import {
  buildLandscape,
  domainDrawer,
  domainOf,
  formatCompactNumber,
  formatExtractedOn,
  hasPrimaryKey,
  tablesForDomain,
  type GwSchema,
} from './gwdbLandscapeModel';

const gw = schema as GwSchema;

describe('gwdb landscape model', () => {
  it('classifies known tables into the six information domains', () => {
    assert.equal(domainOf('GW_BORE_IDENTIFIERS'), 'Bore Information');
    assert.equal(domainOf('GW_WLELES'), 'Water Levels');
    assert.equal(domainOf('GW_WATANLS'), 'Water Quality');
    assert.equal(domainOf('GW_CASINGS'), 'Drilling');
    assert.equal(domainOf('GW_FIELDQS'), 'Monitoring');
    assert.equal(domainOf('CG_REF_CODES'), 'Reference Data');
  });

  it('builds landscape stats from imported Oracle metadata', () => {
    const model = buildLandscape(gw);
    assert.equal(model.tableCount, 81);
    assert.ok(model.columnCount >= 1000);
    assert.equal(model.relationshipCount, 90);
    assert.equal(model.objectCount, 313);
    assert.equal(model.domains.length, 6);
    assert.equal(model.domains.find(d => d.name === 'Water Levels')?.count, 14);
    assert.equal(model.domains.find(d => d.name === 'Water Quality')?.count, 11);
    assert.equal(model.domains.find(d => d.name === 'Drilling')?.count, 13);
    assert.equal(model.domains.find(d => d.name === 'Monitoring')?.count, 9);
    assert.equal(model.domains.find(d => d.name === 'Reference Data')?.count, 15);
    assert.ok((model.domains.find(d => d.name === 'Bore Information')?.count || 0) >= 18);
    assert.equal(model.importantTables.length, 4);
    assert.equal(model.importantTables[0].name, 'GW_REGDETS');
    assert.ok(model.importantTables[0].relationships > 0);
    assert.equal(model.recordVolumes[0].name, 'GW_PROCESSING_LOG');
    assert.ok(model.recordVolumes[0].rows > 1_000_000);
    assert.ok(model.connectedTables > 0);
    assert.ok(model.gaps.length >= 4);
    assert.equal(model.lastExtracted, '2 Sep 2026');
    assert.ok(model.documentedPct > 0);
  });

  it('computes domain drawer stats from the selected domain tables', () => {
    const drawer = domainDrawer(buildLandscape(gw), 'Bore Information');
    assert.ok(drawer.tables >= 18);
    assert.ok(drawer.columns > 0);
    assert.ok(drawer.confirmedRelationships >= 0);
  });

  it('lists the physical tables in a selected domain', () => {
    const model = buildLandscape(gw);
    const monitoring = tablesForDomain(model, 'Monitoring');
    assert.equal(monitoring.length, 9);
    assert.ok(monitoring.some(t => t.name === 'GW_FIELDQS'));
    assert.equal(tablesForDomain(model, 'Water Levels').length, 14);
  });

  it('formats row volumes and detects keys', () => {
    assert.equal(formatCompactNumber(57_158_596), '57.2M');
    assert.equal(formatCompactNumber(576_580), '577K');
    assert.equal(formatCompactNumber(226_460), '226K');
    assert.equal(formatCompactNumber(509), '509');
    assert.equal(hasPrimaryKey(gw.tables.find(t => t.name === 'GW_REGDETS')!), true);
    assert.ok(formatExtractedOn(gw.tables).includes('2026'));
  });
});
