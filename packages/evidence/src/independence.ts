import { hostnameOf, jaccard, normalizeUrl, newId, type Source, type SourceRelationship } from "@paradox/shared";

export function detectSourceRelationships(sources: Source[]): SourceRelationship[] {
  const rels: SourceRelationship[] = [];
  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      const a = sources[i];
      const b = sources[j];
      const rel = classifyPair(a, b);
      if (rel) {
        rels.push({
          id: newId("srel"),
          fromSourceId: a.id,
          toSourceId: b.id,
          relationship: rel.relationship,
          reason: rel.reason,
        });
      }
    }
  }
  applyIndependence(sources, rels);
  return rels;
}

function classifyPair(a: Source, b: Source): { relationship: SourceRelationship["relationship"]; reason: string } | null {
  if (a.url && b.url && normalizeUrl(a.url) === normalizeUrl(b.url)) {
    return { relationship: "REPOST", reason: "Identical normalized URL" };
  }
  const ha = hostnameOf(a.url);
  const hb = hostnameOf(b.url);
  const titleSim = jaccard(a.title, b.title);
  const snippetSim = jaccard(a.snippet, b.snippet);
  if (ha && hb && ha === hb && titleSim > 0.8) {
    return { relationship: "REPOST", reason: "Same host and near-identical title" };
  }
  if (snippetSim > 0.85 && titleSim > 0.6) {
    return { relationship: "SYNDICATED", reason: "Near-duplicate title and snippet across sources" };
  }
  if (snippetSim > 0.55 && titleSim > 0.4) {
    return { relationship: "DERIVED", reason: "High lexical overlap suggesting derivation" };
  }
  return null;
}

function applyIndependence(sources: Source[], rels: SourceRelationship[]): void {
  const dep = new Map<string, number>();
  for (const s of sources) dep.set(s.id, 0);
  for (const r of rels) {
    if (r.relationship === "REPOST" || r.relationship === "SYNDICATED" || r.relationship === "DERIVED") {
      dep.set(r.toSourceId, (dep.get(r.toSourceId) ?? 0) + 1);
      dep.set(r.fromSourceId, (dep.get(r.fromSourceId) ?? 0) + 0.5);
    }
  }
  for (const s of sources) {
    const d = dep.get(s.id) ?? 0;
    s.independenceScore = Math.max(0.15, 1 / (1 + d));
  }
}

export function independentSourceCount(sources: Source[]): number {
  const seen = new Set<string>();
  let n = 0;
  for (const s of sources) {
    const key = hostnameOf(s.url) ?? s.id;
    if (s.independenceScore < 0.4) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    n += 1;
  }
  return n;
}
