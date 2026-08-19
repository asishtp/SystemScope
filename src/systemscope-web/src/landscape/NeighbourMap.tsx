import type { LandscapeLink, LandscapeSystem } from './catalog';
import { graphNeighbours } from './assessment';
import './landscape.css';

export function NeighbourMap({
  system,
  catalog,
  links,
  onLinkFinding,
}: {
  system: { name: string; acronym: string };
  catalog: LandscapeSystem[];
  links: LandscapeLink[];
  onLinkFinding?: (from: string, to: string, label?: string) => void;
}) {
  const node = catalog.find(s => s.acronym === system.acronym || s.name === system.name);
  if (!node) return <p className="ls-mini-empty">This system is not on the landscape map.</p>;
  const { inbound, outbound } = graphNeighbours(node.id, links);
  const byId = Object.fromEntries(catalog.map(s => [s.id, s]));
  return (
    <div className="ls-mini">
      <p className="ls-mini-title">{node.acronym} on the landscape</p>
      <div className="ls-mini-hub"><b>{node.acronym}</b><small>{node.name}</small></div>
      <ul>
        {outbound.map(l => (
          <li key={`o-${l.to}-${l.label ?? ''}`}>
            <button type="button" onClick={() => onLinkFinding?.(l.from, l.to, l.label)}>
              Out → {byId[l.to]?.acronym ?? l.to}{l.label ? ` · ${l.label}` : ''}
            </button>
          </li>
        ))}
        {inbound.map(l => (
          <li key={`i-${l.from}-${l.label ?? ''}`}>
            <button type="button" onClick={() => onLinkFinding?.(l.from, l.to, l.label)}>
              In ← {byId[l.from]?.acronym ?? l.from}{l.label ? ` · ${l.label}` : ''}
            </button>
          </li>
        ))}
      </ul>
      {outbound.length === 0 && inbound.length === 0 && <p>No mapped interfaces.</p>}
    </div>
  );
}
