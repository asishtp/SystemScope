import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import {
  CANVAS,
  categoryLabel,
  landscapeLinks as seedLinks,
  landscapeSystems as seedSystems,
  type LandscapeCategory,
  type LandscapeLink,
  type LandscapeSystem,
} from './catalog';
import {
  blastRadius,
  capabilityOf,
  compareLabel,
  defaultToBeDisposition,
  deriveEstateStatus,
  focusViewport,
  graphNeighbours,
  isolateShown,
  neighbourhood,
  landscapeClusters,
  pinSummary,
  queryHits,
  SWIMLANES,
  swimlanePositions,
  type AssessmentFacts,
  type BoxStatus,
  type Disposition,
} from './assessment';
import { HOSTING_LANES, hsiPositions, linkProfileOf, profileOf } from './profiles';
import { api } from './api';
import { exportMapPng, printAssessmentPack } from './exportMap';
import './landscape.css';

type RegisteredSystem = { id: string; name: string; acronym: string; description: string; criticality: string; lifecycle: string; projectId?: string };
type Project = { id: string; name: string; systems: RegisteredSystem[] };
type Template = { id: string };
type Finding = { id: string; projectId: string; systemId: string; title: string; type: string; severity: string; owner?: string };
type Action = { id: string; systemId?: string | null; status: string; dueDate: string; title: string; owner?: string };
type Filter = 'all' | LandscapeCategory | 'regional' | 'decommissioned' | 'public';
type Layer = 'asis' | 'tobe' | 'compare';
type Snapshot = { id: string; version: string; layer: string; title: string; confirmedBy: string; confirmedAt?: string; changeNote: string; document: string; createdAt: string };

const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All systems' },
  { id: 'water-management', label: 'Water management' },
  { id: 'water-monitoring', label: 'Water monitoring' },
  { id: 'dor-des', label: 'DOR / DES' },
  { id: 'external', label: 'External' },
  { id: 'rural-water-futures', label: 'Rural Water Futures' },
  { id: 'regional', label: 'Regional tools' },
  { id: 'decommissioned', label: 'Decommissioning' },
  { id: 'public', label: 'Public facing' },
];

function box(sys: LandscapeSystem) {
  return { x: sys.x, y: sys.y, r: sys.x + sys.w, b: sys.y + sys.h, cx: sys.x + sys.w / 2, cy: sys.y + sys.h / 2 };
}

function linkGeometry(from: LandscapeSystem, to: LandscapeSystem) {
  const a = box(from);
  const b = box(to);
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const gap = 12;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const right = dx >= 0;
    const x1 = right ? a.r + gap : a.x - gap;
    const y1 = a.cy;
    const x2 = right ? b.x - gap : b.r + gap;
    const y2 = b.cy;
    const mid = (x1 + x2) / 2;
    return { d: `M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`, label: { x: mid, y: (y1 + y2) / 2 - 7 }, tip: { x: x2, y: y2 }, prev: { x: mid, y: y2 } };
  }
  const down = dy >= 0;
  const x1 = a.cx;
  const y1 = down ? a.b + gap : a.y - gap;
  const x2 = b.cx;
  const y2 = down ? b.y - gap : b.b + gap;
  const mid = (y1 + y2) / 2;
  return { d: `M ${x1} ${y1} V ${mid} H ${x2} V ${y2}`, label: { x: (x1 + x2) / 2, y: mid - 7 }, tip: { x: x2, y: y2 }, prev: { x: x2, y: mid } };
}

function arrowPoints(tip: { x: number; y: number }, prev: { x: number; y: number }, size = 11) {
  let dx = tip.x - prev.x;
  let dy = tip.y - prev.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  const bx = tip.x - dx * size;
  const by = tip.y - dy * size;
  return `${tip.x},${tip.y} ${bx - dy * size * 0.58},${by + dx * size * 0.58} ${bx + dy * size * 0.58},${by - dx * size * 0.58}`;
}

function cloneSeed(): { systems: LandscapeSystem[]; links: LandscapeLink[] } {
  return { systems: seedSystems.map(s => ({ ...s, bullets: [...s.bullets] })), links: seedLinks.map(l => ({ ...l })) };
}

export function LandscapeView({
  projects,
  templates,
  findings,
  actions,
  onRefresh,
  onStart,
  onOpenProject,
  onOpenFindings,
  onOpenActions,
}: {
  projects: Project[];
  templates: Template[];
  findings: Finding[];
  actions: Action[];
  onRefresh: () => Promise<void>;
  onStart: (system: RegisteredSystem) => void;
  onOpenProject: (projectId: string) => void;
  onOpenFindings: () => void;
  onOpenActions: () => void;
}) {
  const seed = useMemo(cloneSeed, []);
  const viewportRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.78);
  const [pan, setPan] = useState({ x: 20, y: 12 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const nodeDrag = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number; wasSelected: boolean } | null>(null);
  const moved = useRef(false);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(false);
  const [systems, setSystems] = useState(seed.systems);
  const [links, setLinks] = useState(seed.links);
  const [dispositions, setDispositions] = useState<Record<string, Disposition>>({});
  const [layer, setLayer] = useState<Layer>('asis');
  const [heat, setHeat] = useState(false);
  const [blast, setBlast] = useState(false);
  const [lanes, setLanes] = useState(false);
  const [multi, setMulti] = useState(false);
  const [drawLink, setDrawLink] = useState(false);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [selectedLink, setSelectedLink] = useState<LandscapeLink | null>(null);
  const [adding, setAdding] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [assessments, setAssessments] = useState<AssessmentFacts['assessments']>([]);
  const [evidence, setEvidence] = useState<AssessmentFacts['evidence']>([]);
  const [notice, setNotice] = useState('');
  const [versionNote, setVersionNote] = useState('Layout and scope update');
  const [movingId, setMovingId] = useState<string | null>(null);
  const [focus, setFocus] = useState(true);
  const [hops, setHops] = useState(1);
  const [hsi, setHsi] = useState(false);
  const [hostingFilter, setHostingFilter] = useState('all');
  const [identityFilter, setIdentityFilter] = useState('all');
  const [techFilter, setTechFilter] = useState('all');
  const [drawerTab, setDrawerTab] = useState<'overview' | 'technology' | 'data' | 'assessment' | 'records'>('overview');

  const project = projects.find(p => p.id === projectId) ?? projects[0];

  useEffect(() => {
    if (!projectId && projects[0]) setProjectId(projects[0].id);
  }, [projects, projectId]);

  const loadSide = async () => {
    const [snaps, assess, ev] = await Promise.all([
      api<Snapshot[]>('/landscape').catch(() => [] as Snapshot[]),
      api<AssessmentFacts['assessments']>('/assessments').catch(() => [] as AssessmentFacts['assessments']),
      api<Array<{ systemId?: string | null; title: string; validated: boolean; updatedAt?: string; source?: string }>>('/evidence').catch(() => []),
    ]);
    setSnapshots(snaps);
    setAssessments(assess);
    setEvidence(ev.map(e => ({ systemId: e.systemId ?? null, title: e.title, validated: e.validated, updatedAt: e.updatedAt, source: e.source })));
    const latest = snaps.find(s => s.layer === 'AsIs') ?? snaps[0];
    if (latest) applySnapshot(latest);
  };

  useEffect(() => { loadSide().catch(e => setNotice(String(e.message ?? e))); }, []);

  const applySnapshot = (snap: Snapshot) => {
    try {
      const doc = JSON.parse(snap.document) as { systems?: LandscapeSystem[]; links?: LandscapeLink[]; dispositions?: Record<string, Disposition> };
      if (doc.systems?.length) setSystems(doc.systems);
      if (doc.links?.length) setLinks(doc.links);
      if (doc.dispositions) setDispositions(doc.dispositions);
      setLayer(snap.layer.toLowerCase() === 'tobe' ? 'tobe' : 'asis');
    } catch { /* keep seed */ }
  };

  const registered = useMemo(
    () => (project?.systems ?? []).map(s => ({ ...s, projectId: project.id })),
    [project],
  );

  const facts: AssessmentFacts = useMemo(() => ({
    systems: registered.map(s => ({ id: s.id, projectId: s.projectId ?? project?.id ?? '', name: s.name, acronym: s.acronym })),
    assessments,
    findings: findings.filter(f => !project || f.projectId === project.id).map(f => ({ systemId: f.systemId, type: f.type, severity: f.severity })),
    actions: actions.map(a => ({ systemId: a.systemId ?? null, status: a.status, dueDate: a.dueDate })),
    evidence,
  }), [registered, assessments, findings, actions, evidence, project]);

  const displaySystems = useMemo(() => {
    if (hsi) {
      const packed = hsiPositions(systems);
      return systems.map(s => packed[s.id] ? { ...s, x: packed[s.id].x, y: packed[s.id].y } : s);
    }
    if (!lanes) return systems;
    const packed = swimlanePositions(systems);
    return systems.map(s => packed[s.id] ? { ...s, x: packed[s.id].x, y: packed[s.id].y } : s);
  }, [systems, lanes, hsi]);

  const statuses = useMemo(() => deriveEstateStatus(displaySystems, facts, links), [displaySystems, facts, links]);
  const statusBy = useMemo(() => Object.fromEntries(statuses.map(s => [s.catalogId, s])), [statuses]);
  const byId = useMemo(() => Object.fromEntries(displaySystems.map(s => [s.id, s])), [displaySystems]);
  const selected = selectedId ? byId[selectedId] : undefined;
  const selectedStatus = selectedId ? statusBy[selectedId] : undefined;
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const hits = useMemo(() => queryHits(displaySystems, q), [displaySystems, q]);
  const filterHits = useMemo(() => new Set(displaySystems.filter(s => {
    if (filter === 'all') return true;
    if (filter === 'regional') return !!s.regional;
    if (filter === 'decommissioned') return !!s.decommissioned;
    if (filter === 'public') return s.zone === 'public';
    return s.category === filter;
  }).map(s => s.id)), [displaySystems, filter]);

  const profileHits = useMemo(() => new Set(displaySystems.filter(s => {
    const p = profileOf(s.id);
    if (hostingFilter !== 'all' && p.hosting !== hostingFilter) return false;
    if (identityFilter !== 'all' && p.identity !== identityFilter) return false;
    if (techFilter !== 'all' && p.ui !== techFilter) return false;
    return true;
  }).map(s => s.id)), [displaySystems, hostingFilter, identityFilter, techFilter]);

  const shownIds = useMemo(() => {
    let ids = isolateShown(displaySystems.map(s => s.id), {
      queryHits: searching ? hits : undefined,
      filterHits: filter === 'all' && !searching ? undefined : filterHits,
      edges: links,
      includeContext: searching,
    });
    ids = new Set([...ids].filter(id => profileHits.has(id)));
    if (focus && selectedId && !searching) {
      const near = neighbourhood(selectedId, links, hops);
      ids = new Set([...ids].filter(id => near.has(id)));
    }
    return ids;
  }, [displaySystems, searching, hits, filter, filterHits, links, profileHits, focus, selectedId, hops]);

  const blastIds = selectedId && blast ? new Set([selectedId, ...blastRadius(selectedId, links)]) : null;
  const highlightId = selectedId ?? hoverId;
  const highlightSet = blastIds ?? (highlightId ? new Set([highlightId, ...blastRadius(highlightId, links).slice(0, 0), ...[highlightId]]) : null);

  const canvas = useMemo(() => {
    if (!lanes && !hsi) return CANVAS;
    const maxX = Math.max(CANVAS.width, ...displaySystems.map(s => s.x + s.w + 40));
    const maxY = Math.max(CANVAS.height, (hsi ? HOSTING_LANES.length * 180 : SWIMLANES.length * 150) + 80);
    return { width: maxX, height: maxY };
  }, [displaySystems, lanes, hsi]);

  const fitShown = () => {
    const el = viewportRef.current;
    if (!el) return;
    const boxes = displaySystems.filter(s => shownIds.has(s.id)).map(s => ({ x: s.x, y: s.y, w: s.w, h: s.h }));
    const next = focusViewport(boxes.length ? boxes : displaySystems, { width: el.clientWidth, height: el.clientHeight });
    setZoom(next.zoom);
    setPan(next.pan);
  };

  useEffect(() => { fitShown(); }, []);
  useEffect(() => {
    if (!searching) return;
    fitShown();
    const first = [...hits][0];
    if (first) setSelectedId(first);
  }, [q]);

  useEffect(() => {
    if (focus && selectedId) fitShown();
  }, [focus, hops, selectedId]);

  const identityOptions = useMemo(() => [...new Set(systems.map(s => profileOf(s.id).identity))].sort(), [systems]);
  const techOptions = useMemo(() => [...new Set(systems.map(s => profileOf(s.id).ui))].sort(), [systems]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (full) {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
        setFull(false);
        return;
      }
      setSelectedId(null);
      setSelectedLink(null);
      setPicked(new Set());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [full]);

  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement) setFull(false); };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    document.body.style.overflow = full ? 'hidden' : '';
    const id = requestAnimationFrame(() => fitShown());
    return () => { document.body.style.overflow = ''; cancelAnimationFrame(id); };
  }, [full]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const node = nodeDrag.current;
      if (node) {
        if (Math.abs(e.clientX - node.startX) + Math.abs(e.clientY - node.startY) > 3) moved.current = true;
        if (!moved.current) return;
        const sys = systems.find(s => s.id === node.id);
        if (!sys) return;
        const z = zoomRef.current || 1;
        const x = Math.min(Math.max(0, node.origX + (e.clientX - node.startX) / z), canvas.width - sys.w);
        const y = Math.min(Math.max(0, node.origY + (e.clientY - node.startY) / z), canvas.height - sys.h);
        setSystems(cur => cur.map(s => s.id === node.id ? { ...s, x, y } : s));
        return;
      }
      const canvasDrag = drag.current;
      if (!canvasDrag) return;
      if (Math.abs(e.clientX - canvasDrag.x) + Math.abs(e.clientY - canvasDrag.y) > 3) moved.current = true;
      setPan({ x: canvasDrag.px + (e.clientX - canvasDrag.x), y: canvasDrag.py + (e.clientY - canvasDrag.y) });
    };
    const onUp = () => {
      if (nodeDrag.current) {
        const node = nodeDrag.current;
        nodeDrag.current = null;
        setMovingId(null);
        if (!moved.current && node.wasSelected && !multi) setSelectedId(null);
        return;
      }
      if (drag.current) {
        if (!moved.current) { setSelectedId(null); setSelectedLink(null); }
        drag.current = null;
        setDragging(false);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [systems, canvas.width, canvas.height, multi]);

  const toggleFull = async () => {
    if (full) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      setFull(false);
      return;
    }
    setFull(true);
    await rootRef.current?.requestFullscreen?.().catch(() => undefined);
  };

  const beginNodeDrag = (e: ReactPointerEvent<HTMLElement>, sys: LandscapeSystem) => {
    e.preventDefault();
    e.stopPropagation();
    moved.current = false;
    if (drawLink) {
      if (!linkFrom) { setLinkFrom(sys.id); return; }
      if (linkFrom !== sys.id) {
        setLinks(cur => [...cur, { from: linkFrom, to: sys.id, label: 'New interface', kind: 'data' }]);
        setLinkFrom(null);
        setDrawLink(false);
      }
      return;
    }
    if (multi) {
      setPicked(cur => {
        const next = new Set(cur);
        if (next.has(sys.id)) next.delete(sys.id); else next.add(sys.id);
        return next;
      });
      setSelectedId(sys.id);
      return;
    }
    nodeDrag.current = { id: sys.id, startX: e.clientX, startY: e.clientY, origX: sys.x, origY: sys.y, wasSelected: selectedId === sys.id };
    setMovingId(sys.id);
    setSelectedId(sys.id);
    setSelectedLink(null);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.ls-node, .ls-drawer, .ls-toolbar, .ls-link-hit, button, input, select, a')) return;
    moved.current = false;
    drag.current = { x: e.clientX, y: e.clientY, px: panRef.current.x, py: panRef.current.y };
    setDragging(true);
  };

  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const current = zoomRef.current;
    const next = Math.min(1.8, Math.max(0.35, current * (e.deltaY < 0 ? 1.08 : 0.92)));
    const scale = next / current;
    const p = panRef.current;
    setPan({ x: mx - (mx - p.x) * scale, y: my - (my - p.y) * scale });
    setZoom(next);
  };

  const addPickedToProject = async (ids?: string[]) => {
    if (!project) { setNotice('Create a project first.'); return; }
    const source = ids ?? [...picked];
    const toAdd = source.map(id => byId[id]).filter(Boolean).filter(s => !statusBy[s.id]?.inScope);
    if (!toAdd.length) { setNotice('Selected systems are already in the project.'); return; }
    setBusy(true);
    try {
      await api(`/projects/${project.id}/systems/batch`, {
        method: 'POST',
        body: JSON.stringify({
          systems: toAdd.map(s => ({
            name: s.name, acronym: s.acronym, description: s.description,
            businessOwner: '', technicalOwner: '', criticality: s.criticality,
            lifecycle: s.decommissioned ? 'Decommissioned' : 'Active',
          })),
        }),
      });
      setPicked(new Set());
      setNotice(`${toAdd.length} system(s) added to ${project.name}`);
      await onRefresh();
    } catch (e) { setNotice(String(e)); } finally { setBusy(false); }
  };

  const startCluster = async (clusterId: string) => {
    if (!project || !templates[0]) { setNotice('Create a project first.'); return; }
    const cluster = landscapeClusters.find(c => c.id === clusterId);
    if (!cluster) return;
    setBusy(true);
    try {
      const missing = cluster.systemIds.map(id => byId[id]).filter(s => s && !statusBy[s.id]?.inScope);
      if (missing.length) {
        await api(`/projects/${project.id}/systems/batch`, {
          method: 'POST',
          body: JSON.stringify({
            systems: missing.map(s => ({
              name: s.name, acronym: s.acronym, description: s.description,
              businessOwner: '', technicalOwner: '', criticality: s.criticality, lifecycle: 'Active',
            })),
          }),
        });
        await onRefresh();
      }
      const fresh = await api<Project[]>(`/projects`);
      const proj = fresh.find(p => p.id === project.id);
      const first = proj?.systems.find(s => cluster.systemIds.some(id => byId[id] && (s.acronym === byId[id].acronym || s.name === byId[id].name)));
      if (first) onStart({ ...first, projectId: project.id });
      setNotice(`Cluster ${cluster.name}: ${cluster.systemIds.length} systems in scope. Opening the first workshop.`);
    } catch (e) { setNotice(String(e)); } finally { setBusy(false); }
  };

  const createOnLink = async (kind: 'integration' | 'finding' | 'action') => {
    if (!selectedLink || !project) return;
    const from = byId[selectedLink.from];
    const st = from ? statusBy[from.id] : undefined;
    if (!st?.registeredId) { setNotice('Register the source system in the project first.'); return; }
    setBusy(true);
    try {
      const label = `${from?.acronym ?? selectedLink.from} → ${byId[selectedLink.to]?.acronym ?? selectedLink.to}`;
      if (kind === 'integration') {
        await api(`/systems/${st.registeredId}/integrations`, {
          method: 'POST',
          body: JSON.stringify({ projectId: project.id, name: label, target: byId[selectedLink.to]?.name ?? selectedLink.to, method: selectedLink.kind ?? 'API', owner: '', monitoring: selectedLink.label ?? '' }),
        });
      } else if (kind === 'finding') {
        await api('/findings', {
          method: 'POST',
          body: JSON.stringify({
            projectId: project.id, systemId: st.registeredId, type: 'Dependency', title: `Interface ${label}`,
            description: selectedLink.label ?? 'Landscape interface', severity: 'Moderate', likelihood: 3, impact: 3, owner: 'Unassigned',
            evidenceGapRationale: 'Recorded from landscape interface review.',
          }),
        });
      } else {
        await api('/actions', {
          method: 'POST',
          body: JSON.stringify({
            projectId: project.id, systemId: st.registeredId, title: `Confirm interface ${label}`,
            owner: 'Unassigned', dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), priority: 'Should',
          }),
        });
      }
      setNotice(`${kind} created for ${label}`);
      await onRefresh();
    } catch (e) { setNotice(String(e)); } finally { setBusy(false); }
  };

  const saveVersion = async () => {
    setBusy(true);
    try {
      const next = `v${(snapshots.length + 6)}.0`;
      await api('/landscape', {
        method: 'POST',
        body: JSON.stringify({
          version: next,
          layer: layer === 'tobe' ? 'ToBe' : 'AsIs',
          title: `Water management landscape ${next}`,
          confirmedBy: 'Local Assessment Lead',
          changeNote: versionNote,
          document: JSON.stringify({ systems, links, dispositions }),
        }),
      });
      await loadSide();
      setNotice(`Saved landscape ${next}`);
    } catch (e) { setNotice(String(e)); } finally { setBusy(false); }
  };

  const addSystem = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const id = (data.acronym || data.name).toLowerCase().replace(/[^a-z0-9]+/g, '-') || `sys-${Date.now()}`;
    setSystems(cur => [...cur, {
      id, name: data.name, acronym: data.acronym || data.name, description: data.description || '',
      bullets: [], category: (data.category as LandscapeCategory) || 'water-management', zone: 'core',
      x: 80, y: 80, w: 200, h: 72, criticality: 'Moderate', regional: false, decommissioned: false,
    }]);
    setDispositions(cur => ({ ...cur, [id]: 'add' }));
    setAdding(false);
    setSelectedId(id);
  };

  const toggleFlag = (id: string, flag: 'regional' | 'decommissioned') => {
    setSystems(cur => cur.map(s => s.id === id ? { ...s, [flag]: !s[flag] } : s));
  };

  const asIsIds = useMemo(() => new Set(seed.systems.map(s => s.id)), [seed.systems]);
  const toBeNodes = useMemo(() => displaySystems.map(s => ({
    id: s.id,
    disposition: dispositions[s.id] ?? defaultToBeDisposition(s.id, s.decommissioned),
  })), [displaySystems, dispositions]);

  const shownList = displaySystems.filter(s => shownIds.has(s.id));

  return (
    <div ref={rootRef} className={`ls${selected || selectedLink ? ' ls-open' : ''}${full ? ' ls-full' : ''}`}>
      <section className="ls-intro">
        <div>
          <h2>Water management value chain — assessment workspace</h2>
          <p>Scope from the map, read coverage on the estate, and file findings on interfaces. Versioned as-is / to-be record.</p>
        </div>
        <span>OFFICIAL · {shownList.length}/{systems.length}</span>
      </section>

      <div className="ls-toolbar">
        <input className="ls-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a system — map isolates and centres" aria-label="Search landscape systems" />
        {searching && <span className="ls-search-count">{hits.size === 0 ? 'No matches' : `${hits.size} match${hits.size === 1 ? '' : 'es'}`}</span>}
        <div className="ls-filters" role="tablist">
          {filters.map(f => (
            <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} className={filter === f.id ? 'on' : ''} onClick={() => setFilter(f.id)}>{f.label}</button>
          ))}
        </div>
        <div className="ls-zoom">
          <button type="button" onClick={() => setZoom(z => Math.max(0.35, z - 0.1))}>−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom(z => Math.min(1.8, z + 0.1))}>+</button>
          <button type="button" onClick={fitShown}>Fit</button>
          <button type="button" className="ls-full-btn" onClick={toggleFull}>{full ? 'Exit full screen' : 'Full screen'}</button>
        </div>
      </div>

      <div className="ls-toolbar ls-modes">
        <label>Project
          <select value={project?.id ?? ''} onChange={e => setProjectId(e.target.value)}>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            {!projects.length && <option value="">No project yet</option>}
          </select>
        </label>
        <div className="ls-filters">
          {(['asis', 'tobe', 'compare'] as Layer[]).map(l => (
            <button key={l} type="button" className={layer === l ? 'on' : ''} onClick={() => setLayer(l)}>{l === 'asis' ? 'As-is' : l === 'tobe' ? 'To-be' : 'Compare'}</button>
          ))}
          <button type="button" className={heat ? 'on' : ''} onClick={() => setHeat(h => !h)}>Coverage heat</button>
          <button type="button" className={blast ? 'on' : ''} onClick={() => setBlast(b => !b)}>Blast radius</button>
          <button type="button" className={focus ? 'on' : ''} onClick={() => setFocus(v => !v)}>Focus</button>
          {focus && (
            <label>Hops
              <select value={hops} onChange={e => setHops(Number(e.target.value))}>
                <option value={1}>1 hop</option>
                <option value={2}>2 hops</option>
                <option value={3}>3 hops</option>
              </select>
            </label>
          )}
          <button type="button" className={hsi ? 'on' : ''} onClick={() => { setHsi(v => !v); if (!hsi) setLanes(false); }}>HSI view</button>
          <button type="button" className={lanes && !hsi ? 'on' : ''} onClick={() => { setLanes(v => !v); if (!lanes) setHsi(false); }}>Swimlanes</button>
          <button type="button" className={multi ? 'on' : ''} onClick={() => setMulti(v => !v)}>Multi-select</button>
          <button type="button" className={drawLink ? 'on' : ''} onClick={() => { setDrawLink(v => !v); setLinkFrom(null); }}>Draw link</button>
          <button type="button" onClick={() => setAdding(true)}>Add system</button>
        </div>
        <button type="button" className="primary" disabled={!picked.size || busy} onClick={() => addPickedToProject([...picked])}>Add {picked.size || ''} to project</button>
        <select aria-label="Assess cluster" defaultValue="" onChange={e => { if (e.target.value) startCluster(e.target.value); e.target.value = ''; }}>
          <option value="">Assess cluster…</option>
          {landscapeClusters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button type="button" onClick={() => exportMapPng(shownList, links, statuses, 'Water management landscape')}>Export PNG</button>
        <button type="button" onClick={() => printAssessmentPack(displaySystems, statuses, links, facts.findings, 'Landscape assessment pack')}>Print pack</button>
      </div>

      <div className="ls-toolbar">
        <input value={versionNote} onChange={e => setVersionNote(e.target.value)} aria-label="Version note" />
        <button type="button" disabled={busy} onClick={saveVersion}>Save version</button>
        <select aria-label="Saved versions" defaultValue="" onChange={e => {
          const snap = snapshots.find(s => s.id === e.target.value);
          if (snap) applySnapshot(snap);
          e.target.value = '';
        }}>
          <option value="">{snapshots.length ? `${snapshots.length} saved versions` : 'No saved versions'}</option>
          {snapshots.map(s => <option key={s.id} value={s.id}>{s.layer} {s.version} · {s.confirmedBy} · {s.changeNote}</option>)}
        </select>
        <label>Hosting
          <select value={hostingFilter} onChange={e => setHostingFilter(e.target.value)}>
            <option value="all">All hosting</option>
            {HOSTING_LANES.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
          </select>
        </label>
        <label>Identity
          <select value={identityFilter} onChange={e => setIdentityFilter(e.target.value)}>
            <option value="all">All identity</option>
            {identityOptions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label>UI tech
          <select value={techFilter} onChange={e => setTechFilter(e.target.value)}>
            <option value="all">All UI</option>
            {techOptions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      </div>

      {notice && <div className="notice">{notice}<button type="button" onClick={() => setNotice('')}>×</button></div>}

      <div className="ls-legend">
        <span className="lg water-management">Water management</span>
        <span className="lg water-monitoring">Water monitoring</span>
        <span className="st not-in-scope">Not in scope</span>
        <span className="st registered">Registered</span>
        <span className="st in-workshop">In workshop</span>
        <span className="st submitted">Submitted</span>
        <span className="st approved">Approved</span>
        <span className="st heat-green">Coverage</span>
        {hsi && HOSTING_LANES.map(h => <span key={h.id} className={`st host-${h.id}`}>{h.label}</span>)}
        <span className="ls-hint">{focus && selected ? `Focus: ${selected.acronym} · ${hops} hop${hops === 1 ? '' : 's'}. Turn Focus off for the full estate.` : drawLink ? (linkFrom ? 'Click a target system to finish the link.' : 'Click a source system.') : multi ? 'Click systems to add to the scope set.' : 'Drag to move. Click a line to record an interface finding.'}</span>
      </div>

      <div className="ls-workspace">
        <div ref={viewportRef} className={`ls-viewport${dragging ? ' dragging' : ''}${movingId ? ' moving' : ''}`} onWheel={onWheel} onPointerDown={onPointerDown}>
          <div className="ls-canvas" style={{ width: canvas.width, height: canvas.height, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            {hsi && HOSTING_LANES.map((lane, i) => (
              <div key={lane.id} className="ls-lane" style={{ left: 8, top: 8 + i * 180, width: canvas.width - 16, height: 172 }}>
                <small>{lane.label}</small>
              </div>
            ))}
            {lanes && !hsi && SWIMLANES.map((lane, i) => (
              <div key={lane.id} className="ls-lane" style={{ left: 8, top: 8 + i * 150, width: canvas.width - 16, height: 142 }}>
                <small>{lane.label}</small>
              </div>
            ))}
            {!lanes && !hsi && !searching && !focus && <div className="ls-band ls-internal" style={{ left: 8, top: 8, width: 220, height: 724 }}><small>Departmental registers</small></div>}
            {!lanes && !hsi && !searching && !focus && <div className="ls-band ls-public" style={{ left: 8, top: 756, width: canvas.width - 16, height: 396 }}><small>Queensland Government — public facing</small></div>}

            <svg className="ls-links" viewBox={`0 0 ${canvas.width} ${canvas.height}`} width={canvas.width} height={canvas.height}>
              {links.map(link => {
                const from = byId[link.from];
                const to = byId[link.to];
                if (!from || !to || !shownIds.has(link.from) || !shownIds.has(link.to)) return null;
                if (blastIds && !blastIds.has(link.from) && !blastIds.has(link.to)) return null;
                const hot = !!(highlightId && (link.from === highlightId || link.to === highlightId));
                const geom = linkGeometry(from, to);
                const tone = hot ? ' hot' : highlightSet && !hot ? ' muted' : '';
                return (
                  <g key={`${link.from}-${link.to}-${link.label ?? ''}`}>
                    {hot && <path d={geom.d} className="ls-link-halo" />}
                    <path d={geom.d} className={`ls-link ${link.kind ?? 'data'}${tone}`} />
                    <polygon points={arrowPoints(geom.tip, geom.prev, hot ? 13 : 10)} className={`ls-arrow ${link.kind ?? 'data'}${tone}`} />
                    {hot && link.label && <text className="ls-link-label" x={geom.label.x} y={geom.label.y} textAnchor="middle">{link.label}</text>}
                    <path d={geom.d} className="ls-link-hit" onClick={e => { e.stopPropagation(); setSelectedLink(link); setSelectedId(null); }} />
                  </g>
                );
              })}
            </svg>

            {shownList.map(sys => {
              const st: BoxStatus | undefined = statusBy[sys.id];
              const on = selectedId === sys.id;
              const pickedOn = picked.has(sys.id);
              const disp = layer === 'compare' || layer === 'tobe' ? compareLabel(sys.id, asIsIds, toBeNodes) : undefined;
              if (layer === 'tobe' && disp === 'retire' && sys.decommissioned) {
                /* still show retired so compare is visible */
              }
              const heatClass = heat ? ` heat-${st?.coverage ?? 'none'}` : '';
              const hostClass = hsi ? ` host-${profileOf(sys.id).hosting}` : '';
              const badge = sys.decommissioned ? 'Decomm' : sys.regional ? 'Regional' : '';
              return (
                <div
                  key={sys.id}
                  role="button"
                  tabIndex={0}
                  title={`${sys.acronym} — ${st?.lifecycle ?? 'not in scope'}`}
                  className={`ls-node ${sys.category}${sys.zone === 'public' ? ' public' : ''}${sys.decommissioned ? ' decommissioned' : ''}${on ? ' selected' : ''}${st?.context ? ' context' : ''}${st?.inScope ? ' inscope' : ''}${pickedOn ? ' picked' : ''}${st?.unconfirmed && st.inScope ? ' unconfirmed' : ''}${heatClass}${hostClass}${movingId === sys.id ? ' moving' : ''}${disp ? ` disp-${disp}` : ''}`}
                  style={{ left: sys.x, top: sys.y, width: sys.w, height: sys.h }}
                  aria-pressed={on}
                  onMouseEnter={() => setHoverId(sys.id)}
                  onMouseLeave={() => setHoverId(cur => cur === sys.id ? null : cur)}
                  onPointerDown={e => beginNodeDrag(e, sys)}
                  onClick={e => {
                    e.stopPropagation();
                    if (drawLink || multi) return;
                    setSelectedId(sys.id);
                    setSelectedLink(null);
                  }}
                >
                  <strong>{sys.acronym}</strong>
                  {sys.name !== sys.acronym && <em>{sys.name}</em>}
                  <span className="ls-status">{st?.lifecycle.replace(/-/g, ' ')}{st && st.coveragePercent > 0 ? ` · ${st.coveragePercent}%` : ''}</span>
                  {hsi && <span className="ls-hsi-chip">{profileOf(sys.id).identity}</span>}
                  {st && pinSummary(st) ? <span className="ls-pins">{pinSummary(st)}</span> : null}
                  {st?.context && !st.inScope && <b className="ls-badge">Context</b>}
                  {badge && !st?.context && <b className="ls-badge">{badge}</b>}
                  {disp && layer !== 'asis' && <b className={`ls-badge disp`}>{disp}</b>}
                </div>
              );
            })}
          </div>
        </div>

        {selected && (
          <aside className="ls-drawer" aria-label={`${selected.acronym} details`}>
            <button className="ls-close" type="button" onClick={() => setSelectedId(null)} aria-label="Close">×</button>
            <p className="ls-kicker">{categoryLabel[selected.category]} · {capabilityOf(selected)}</p>
            <div className="ls-crumb">
              <button type="button" onClick={() => { setFocus(false); setSelectedId(null); }}>Full landscape</button>
              <span>/ {selected.acronym}{focus ? ` · ${hops} hop` : ''}</span>
            </div>
            <h3>{selected.acronym}</h3>
            <p className="ls-fullname">{selected.name}</p>
            <div className="ls-tabs">
              {(['overview', 'technology', 'data', 'assessment', 'records'] as const).map(tab => (
                <button key={tab} type="button" className={drawerTab === tab ? 'on' : ''} onClick={() => setDrawerTab(tab)}>{tab}</button>
              ))}
            </div>
            <div className="ls-tags">
              <span>{selectedStatus?.lifecycle.replace(/-/g, ' ')}{selectedStatus && selectedStatus.coveragePercent > 0 ? ` · ${selectedStatus.coveragePercent}%` : ''}</span>
              <span>{selected.criticality}</span>
              {selectedStatus?.inScope && <span className="ok">In scope</span>}
              {selectedStatus?.context && <span>Context / dependency</span>}
              {selected.decommissioned && <span className="warn">Decommissioned</span>}
            </div>
            {drawerTab === 'overview' && <>
              <p>{selected.description}</p>
              {selected.bullets.length > 0 && <ul>{selected.bullets.map(b => <li key={b}>{b}</li>)}</ul>}
              <dl className="ls-dl">
                <div><dt>Business owner</dt><dd>{profileOf(selected.id).businessOwner}</dd></div>
                <div><dt>Technical owner</dt><dd>{profileOf(selected.id).technicalOwner}</dd></div>
                <div><dt>Support / vendor</dt><dd>{profileOf(selected.id).support}</dd></div>
                <div><dt>Capability</dt><dd>{capabilityOf(selected)}</dd></div>
                <div><dt>Lifecycle</dt><dd>{selected.decommissioned ? 'Decommissioned' : 'Active'}</dd></div>
                <div><dt>Criticality</dt><dd>{selected.criticality}</dd></div>
              </dl>
            </>}
            {drawerTab === 'technology' && (
              <dl className="ls-dl">
                <div><dt>User interface</dt><dd>{profileOf(selected.id).ui}</dd></div>
                <div><dt>API / services</dt><dd>{profileOf(selected.id).api}</dd></div>
                <div><dt>Database</dt><dd>{profileOf(selected.id).database}</dd></div>
                <div><dt>Hosting</dt><dd>{profileOf(selected.id).hosting} · {profileOf(selected.id).environment}</dd></div>
                <div><dt>Operating system</dt><dd>{profileOf(selected.id).os}</dd></div>
                <div><dt>Identity</dt><dd>{profileOf(selected.id).identity}</dd></div>
                <div><dt>Repository</dt><dd>{profileOf(selected.id).repo}</dd></div>
                <div><dt>Deployment</dt><dd>{profileOf(selected.id).deploy}</dd></div>
              </dl>
            )}
            {drawerTab === 'data' && <>
              <p><b>Entities:</b> {profileOf(selected.id).dataEntities.join(', ')}</p>
              <p><b>Classification:</b> {profileOf(selected.id).classification}</p>
              <h4>Upstream / downstream</h4>
              <div className="ls-conn">
                {graphNeighbours(selected.id, links).outbound.map(l => (
                  <button type="button" key={`out-${l.to}-${l.label ?? ''}`} onClick={() => { setSelectedLink(links.find(x => x.from === l.from && x.to === l.to && x.label === l.label) ?? null); }}>
                    <small>Downstream{l.label ? ` · ${l.label}` : ''} · {linkProfileOf(l.from, l.to, l.label).method}</small>
                    <b>{byId[l.to]?.acronym ?? l.to}</b>
                  </button>
                ))}
                {graphNeighbours(selected.id, links).inbound.map(l => (
                  <button type="button" key={`in-${l.from}-${l.label ?? ''}`} onClick={() => { setSelectedLink(links.find(x => x.from === l.from && x.to === l.to && x.label === l.label) ?? null); }}>
                    <small>Upstream{l.label ? ` · ${l.label}` : ''} · {linkProfileOf(l.from, l.to, l.label).method}</small>
                    <b>{byId[l.from]?.acronym ?? l.from}</b>
                  </button>
                ))}
              </div>
            </>}
            {drawerTab === 'assessment' && <>
              {selectedStatus?.lastConfirmed && <p className="ls-confirm">Last confirmed {selectedStatus.lastConfirmed.at.slice(0, 10) || 'via SME'} — {selectedStatus.lastConfirmed.source}</p>}
              {selectedStatus?.unconfirmed && selectedStatus.inScope && <p className="ls-confirm warn">Unconfirmed — no validated evidence or SME confirmation.</p>}
              <p>Coverage {selectedStatus?.coverage ?? 'none'} {selectedStatus?.coveragePercent ?? 0}%. {selectedStatus?.informationGaps ?? 0} information gaps. {selectedStatus?.highCriticalFindings ?? 0} high/critical findings.</p>
            </>}
            {drawerTab === 'records' && (
              <div className="ls-conn">
                {findings.filter(f => f.systemId === selectedStatus?.registeredId).map(f => (
                  <button type="button" key={f.id} onClick={onOpenFindings}>
                    <small>{f.severity} · {f.type}</small>
                    <b>{f.title}</b>
                  </button>
                ))}
                {actions.filter(a => a.systemId === selectedStatus?.registeredId).map(a => (
                  <button type="button" key={a.id} onClick={onOpenActions}>
                    <small>{a.status}{a.dueDate ? ` · ${a.dueDate}` : ''}</small>
                    <b>{a.title}</b>
                  </button>
                ))}
                {selectedStatus?.registeredId && !findings.some(f => f.systemId === selectedStatus.registeredId) && !actions.some(a => a.systemId === selectedStatus.registeredId) && (
                  <p>No findings or actions on this system yet.</p>
                )}
                {!selectedStatus?.registeredId && <p>Register this system to attach findings and actions.</p>}
              </div>
            )}
            {(drawerTab === 'overview' || drawerTab === 'data') && <>
              <h4>Connections</h4>
              <div className="ls-conn">
                {graphNeighbours(selected.id, links).outbound.map(l => (
                  <button type="button" key={`out2-${l.to}-${l.label ?? ''}`} onClick={() => { setSelectedId(l.to); setSelectedLink(null); }}>
                    <small>Outbound{l.label ? ` · ${l.label}` : ''}</small>
                    <b>{byId[l.to]?.acronym ?? l.to}</b>
                  </button>
                ))}
                {graphNeighbours(selected.id, links).inbound.map(l => (
                  <button type="button" key={`in2-${l.from}-${l.label ?? ''}`} onClick={() => { setSelectedId(l.from); setSelectedLink(null); }}>
                    <small>Inbound{l.label ? ` · ${l.label}` : ''}</small>
                    <b>{byId[l.from]?.acronym ?? l.from}</b>
                  </button>
                ))}
                {graphNeighbours(selected.id, links).outbound.length === 0 && graphNeighbours(selected.id, links).inbound.length === 0 && <p>No mapped interfaces in the landscape.</p>}
              </div>
            </>}
            {blast && selectedId && (
              <div>
                <h4>Blast radius if {selected.acronym} is lost</h4>
                <div className="ls-conn">
                  {blastRadius(selected.id, links).map(id => (
                    <button type="button" key={id} onClick={() => setSelectedId(id)}><b>{byId[id]?.acronym ?? id}</b></button>
                  ))}
                  {!blastRadius(selected.id, links).length && <p>No downstream dependents on the map.</p>}
                </div>
              </div>
            )}
            <h4>Flags</h4>
            <div className="ls-actions">
              <button type="button" onClick={() => toggleFlag(selected.id, 'regional')}>{selected.regional ? 'Clear regional' : 'Mark regional'}</button>
              <button type="button" onClick={() => toggleFlag(selected.id, 'decommissioned')}>{selected.decommissioned ? 'Clear decommissioned' : 'Flag decommissioned'}</button>
              {(layer === 'tobe' || layer === 'compare') && (
                <label>Disposition
                  <select value={dispositions[selected.id] ?? defaultToBeDisposition(selected.id, selected.decommissioned)} onChange={e => setDispositions(cur => ({ ...cur, [selected.id]: e.target.value as Disposition }))}>
                    <option value="keep">Keep</option>
                    <option value="retire">Retire</option>
                    <option value="replace">Replace</option>
                    <option value="consolidate">Consolidate</option>
                    <option value="add">Add</option>
                  </select>
                </label>
              )}
            </div>
            <h4>Assessment</h4>
            {selectedStatus?.registeredId ? (
              <div className="ls-actions">
                <button type="button" className="primary" onClick={() => {
                  const rec = registered.find(s => s.id === selectedStatus.registeredId);
                  if (rec) onStart(rec);
                }}>Start / continue workshop →</button>
                {project && <button type="button" onClick={() => onOpenProject(project.id)}>Open project</button>}
              </div>
            ) : (
              <div className="ls-actions">
                <button type="button" className="primary" disabled={!project || busy} onClick={() => void addPickedToProject([selected.id])}>Register in project</button>
              </div>
            )}
            <p className="ls-source">Landscape record. Save a version to keep dated confirmation.</p>
          </aside>
        )}

        {selectedLink && (
          <aside className="ls-drawer" aria-label="Interface details">
            <button className="ls-close" type="button" onClick={() => setSelectedLink(null)} aria-label="Close">×</button>
            <p className="ls-kicker">Interface</p>
            <h3>{byId[selectedLink.from]?.acronym} → {byId[selectedLink.to]?.acronym}</h3>
            <p>{selectedLink.label || 'Mapped landscape interface'}</p>
            <dl className="ls-dl">
              <div><dt>Direction</dt><dd>{byId[selectedLink.from]?.acronym} to {byId[selectedLink.to]?.acronym}</dd></div>
              <div><dt>Data exchanged</dt><dd>{linkProfileOf(selectedLink.from, selectedLink.to, selectedLink.label).data}</dd></div>
              <div><dt>Method</dt><dd>{linkProfileOf(selectedLink.from, selectedLink.to, selectedLink.label).method}</dd></div>
              <div><dt>Frequency</dt><dd>{linkProfileOf(selectedLink.from, selectedLink.to, selectedLink.label).frequency}</dd></div>
              <div><dt>Volume</dt><dd>{linkProfileOf(selectedLink.from, selectedLink.to, selectedLink.label).volume}</dd></div>
              <div><dt>Authentication</dt><dd>{linkProfileOf(selectedLink.from, selectedLink.to, selectedLink.label).auth}</dd></div>
              <div><dt>Encryption</dt><dd>{linkProfileOf(selectedLink.from, selectedLink.to, selectedLink.label).encryption}</dd></div>
              <div><dt>Data owner</dt><dd>{linkProfileOf(selectedLink.from, selectedLink.to, selectedLink.label).dataOwner}</dd></div>
              <div><dt>Operational owner</dt><dd>{linkProfileOf(selectedLink.from, selectedLink.to, selectedLink.label).opsOwner}</dd></div>
              <div><dt>Monitoring</dt><dd>{linkProfileOf(selectedLink.from, selectedLink.to, selectedLink.label).monitoring}</dd></div>
              <div><dt>Error handling</dt><dd>{linkProfileOf(selectedLink.from, selectedLink.to, selectedLink.label).errors}</dd></div>
            </dl>
            <h4>Record on this interface</h4>
            <div className="ls-actions">
              <button type="button" onClick={() => createOnLink('integration')}>Create integration</button>
              <button type="button" onClick={() => createOnLink('finding')}>Create finding</button>
              <button type="button" onClick={() => createOnLink('action')}>Add action</button>
            </div>
          </aside>
        )}
      </div>

      {adding && (
        <div className="overlay" onMouseDown={() => setAdding(false)}>
          <dialog open onMouseDown={e => e.stopPropagation()}>
            <button className="close" type="button" onClick={() => setAdding(false)}>×</button>
            <form onSubmit={addSystem}>
              <h2>Add a system to the landscape</h2>
              <label>Name<input name="name" required autoFocus /></label>
              <label>Acronym<input name="acronym" /></label>
              <label>Description<textarea name="description" /></label>
              <label>Category
                <select name="category">
                  <option value="water-management">Water management</option>
                  <option value="water-monitoring">Water monitoring</option>
                  <option value="dor-des">DOR / DES</option>
                  <option value="external">External</option>
                </select>
              </label>
              <button className="primary submit" type="submit">Add to map</button>
            </form>
          </dialog>
        </div>
      )}
    </div>
  );
}
