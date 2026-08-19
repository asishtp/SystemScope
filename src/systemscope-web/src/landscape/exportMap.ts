import type { LandscapeLink, LandscapeSystem } from './catalog';
import type { BoxStatus } from './assessment';
import { reportRows } from './assessment';

export function exportMapPng(
  systems: LandscapeSystem[],
  links: LandscapeLink[],
  statuses: BoxStatus[],
  title: string,
) {
  const pad = 40;
  const maxX = Math.max(400, ...systems.map(s => s.x + s.w));
  const maxY = Math.max(300, ...systems.map(s => s.y + s.h));
  const canvas = document.createElement('canvas');
  canvas.width = maxX + pad * 2;
  canvas.height = maxY + pad * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#8fb9d4';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#10231c';
  ctx.font = 'bold 18px Segoe UI, sans-serif';
  ctx.fillText(title, pad, 28);
  const byId = Object.fromEntries(systems.map(s => [s.id, s]));
  ctx.lineWidth = 2;
  for (const link of links) {
    const from = byId[link.from];
    const to = byId[link.to];
    if (!from || !to) continue;
    ctx.strokeStyle = '#2a6a34';
    ctx.beginPath();
    ctx.moveTo(from.x + from.w / 2 + pad, from.y + from.h / 2 + pad);
    ctx.lineTo(to.x + to.w / 2 + pad, to.y + to.h / 2 + pad);
    ctx.stroke();
  }
  const statusBy = Object.fromEntries(statuses.map(s => [s.catalogId, s]));
  for (const sys of systems) {
    const st = statusBy[sys.id];
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = st?.coverage === 'red' ? '#a83b2b' : st?.coverage === 'green' ? '#157a32' : st?.coverage === 'amber' ? '#b8860b' : '#2d3740';
    ctx.lineWidth = 2.5;
    ctx.fillRect(sys.x + pad, sys.y + pad, sys.w, sys.h);
    ctx.strokeRect(sys.x + pad, sys.y + pad, sys.w, sys.h);
    ctx.fillStyle = '#10231c';
    ctx.font = 'bold 12px Segoe UI, sans-serif';
    ctx.fillText(sys.acronym, sys.x + pad + 8, sys.y + pad + 18);
    ctx.font = '11px Segoe UI, sans-serif';
    ctx.fillText(st?.lifecycle ?? 'not-in-scope', sys.x + pad + 8, sys.y + pad + 34);
  }
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `${title.replace(/\s+/g, '-').toLowerCase()}.png`;
  a.click();
}

export function printAssessmentPack(
  systems: LandscapeSystem[],
  statuses: BoxStatus[],
  links: LandscapeLink[],
  findings: { systemId: string; type: string; severity: string }[],
  title: string,
) {
  const rows = reportRows(systems, statuses, links, findings);
  const html = `<!doctype html><html><head><title>${title}</title>
  <style>body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#17252d}h1{font-size:20px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #c5d4de;padding:8px;vertical-align:top;text-align:left}th{background:#e0f2ee}</style>
  </head><body><h1>${title}</h1><p>In-scope systems, interfaces and findings.</p>
  <table><thead><tr><th>System</th><th>Status</th><th>Coverage</th><th>Interfaces</th><th>Findings</th></tr></thead><tbody>
  ${rows.map(r => `<tr><td><b>${r.acronym}</b><br>${r.name}</td><td>${r.lifecycle}</td><td>${r.coverage} ${r.coveragePercent}%</td><td>${r.interfaces.join('<br>') || '—'}</td><td>${r.findings.join('<br>') || '—'}</td></tr>`).join('')}
  </tbody></table></body></html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}
