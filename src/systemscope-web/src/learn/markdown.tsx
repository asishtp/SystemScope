import type { ReactNode } from 'react';

function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('`')) parts.push(<code key={key++}>{token.slice(1, -1)}</code>);
    else if (token.startsWith('**')) parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) parts.push(<a key={key++} href={link[2]} rel="noreferrer">{link[1]}</a>);
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function parseTable(rows: string[]) {
  const cells = (line: string) => line.split('|').slice(1, -1).map(c => c.trim());
  const body = rows.filter(r => !/^\|?\s*:?-{3,}/.test(r.replace(/\|/g, '|')));
  if (body.length < 2) return null;
  const header = cells(body[0]);
  const data = body.slice(1).filter(r => !/^[\s|:-]+$/.test(r)).map(cells);
  return { header, data };
}

const HUB_POS: Record<string, { x: number; y: number }> = {
  casing: { x: 16, y: 32 },
  aquifer: { x: 50, y: 14 },
  'water analysis': { x: 84, y: 32 },
  'water level': { x: 16, y: 78 },
  images: { x: 84, y: 78 },
  'strata log': { x: 50, y: 88 },
};

function shortLabel(label: string) {
  return label.replace(/\s*-\s*RN.*$/i, '').trim();
}

function MermaidFlow({ source }: { source: string }) {
  const nodes: { id: string; label: string }[] = [];
  const edges: { from: string; to: string; label?: string }[] = [];
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    const node = line.match(/^([A-Za-z0-9_]+)\[([^\]]+)\]$/);
    if (node) { nodes.push({ id: node[1], label: node[2] }); continue; }
    const edge = line.match(/^([A-Za-z0-9_]+)\s*-->\s*(?:\|([^|]+)\|)?\s*([A-Za-z0-9_]+)$/);
    if (edge) edges.push({ from: edge[1], to: edge[3], label: edge[2] });
  }
  const counts = new Map<string, number>();
  for (const e of edges) counts.set(e.from, (counts.get(e.from) ?? 0) + 1);
  const hubId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const hub = nodes.find(n => n.id === hubId);
  if (hub && (counts.get(hub.id) ?? 0) >= 3) {
    return (
      <div className="learn-hub" role="img" aria-label={`${shortLabel(hub.label)} connected to related tables`}>
        <svg className="learn-edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {edges.filter(e => e.from === hub.id).map(e => {
            const target = nodes.find(n => n.id === e.to);
            const pos = HUB_POS[shortLabel(target?.label || '').toLowerCase()] || { x: 50, y: 20 };
            return <line key={e.to} x1="50" y1="50" x2={pos.x} y2={pos.y} stroke="#93b4f5" strokeWidth="1.2" />;
          })}
        </svg>
        <div className="learn-hub-node core" style={{ left: '50%', top: '50%' }}>
          <span>📋</span>
          <b>{shortLabel(hub.label)}</b>
          <small>{hub.label.includes('RN') ? hub.label.replace(/^.*RN\s*/i, 'RN ') : ''}</small>
        </div>
        {nodes.filter(n => n.id !== hub.id).map(n => {
          const pos = HUB_POS[shortLabel(n.label).toLowerCase()] || { x: 50, y: 12 };
          return <div className="learn-hub-node" key={n.id} style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>{iconFor(n.label)} {shortLabel(n.label)}</div>;
        })}
        {edges.filter(e => e.from === hub.id).map(e => {
          const target = nodes.find(n => n.id === e.to);
          const pos = HUB_POS[shortLabel(target?.label || '').toLowerCase()] || { x: 50, y: 20 };
          return <span className="learn-graph-label" key={`${e.to}-rn`} style={{ left: `${(50 + pos.x) / 2}%`, top: `${(50 + pos.y) / 2}%` }}>{e.label || 'RN'}</span>;
        })}
      </div>
    );
  }
  return (
    <div className="learn-flow" role="img" aria-label="Lesson diagram">
      {nodes.map(n => <span className="learn-flow-node" key={n.id}>{n.label}</span>)}
      {edges.length > 0 && <div className="learn-flow-edges">{edges.map((e, i) => <small key={i}>{nodes.find(n => n.id === e.from)?.label} → {e.label ? `${e.label} → ` : ''}{nodes.find(n => n.id === e.to)?.label}</small>)}</div>}
    </div>
  );
}

function iconFor(label: string) {
  const value = label.toLowerCase();
  if (value.includes('casing')) return '🛢️';
  if (value.includes('aquifer')) return '💧';
  if (value.includes('water analysis')) return '🧪';
  if (value.includes('water level')) return '🌊';
  if (value.includes('image')) return '🖼️';
  return '📄';
}

export function MarkdownLesson({ source }: { source: string }) {
  const lines = (source || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  let h2 = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) { body.push(lines[i]); i += 1; }
      i += 1;
      if (lang === 'mermaid') blocks.push(<MermaidFlow key={key++} source={body.join('\n')} />);
      else blocks.push(<pre key={key++}><code>{body.join('\n')}</code></pre>);
      continue;
    }
    if (line.startsWith('|')) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].includes('|')) { rows.push(lines[i]); i += 1; }
      const table = parseTable(rows);
      if (table) {
        blocks.push(
          <div className="learn-table-wrap" key={key++}>
            <table>
              <thead><tr>{table.header.map((c, ci) => <th key={ci}>{inline(c)}</th>)}</tr></thead>
              <tbody>{table.data.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci}>{inline(c)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        );
        continue;
      }
    }
    if (line.startsWith('### ')) { blocks.push(<h3 key={key++}>{inline(line.slice(4))}</h3>); i += 1; continue; }
    if (line.startsWith('## ')) {
      const headingKey = ++h2;
      blocks.push(<h2 id={`section-${headingKey}`} key={key++}>{inline(line.replace(/^##\s+(\d+\.\s+)?/, ''))}</h2>);
      i += 1;
      continue;
    }
    if (line.startsWith('# ')) { blocks.push(<h1 key={key++}>{inline(line.slice(2))}</h1>); i += 1; continue; }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: ReactNode[] = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(<li key={items.length}>{inline(lines[i].slice(2))}</li>);
        i += 1;
      }
      blocks.push(<ul key={key++}>{items}</ul>);
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(<li key={items.length}>{inline(lines[i].replace(/^\d+\.\s/, ''))}</li>);
        i += 1;
      }
      blocks.push(<ol key={key++}>{items}</ol>);
      continue;
    }
    const para: string[] = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !/^#{1,3} |^- |\* |^\d+\.\s|^```|^\|/.test(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    const text = para.join(' ');
    if (/Registered Number:\s*`?\d+/.test(text)) {
      const rn = text.match(/Registered Number:\s*`?(\d+)/);
      blocks.push(<div className="learn-callout" key={key++}><span>ℹ</span> Registered Number: {rn?.[1]}</div>);
    } else {
      blocks.push(<p key={key++}>{inline(text)}</p>);
    }
  }
  return <div className="learn-md">{blocks}</div>;
}
