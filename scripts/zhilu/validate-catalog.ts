import { readFileSync } from 'node:fs';
import { graphSchema } from '../../shared/api.interface';
import { parsePath } from '../../shared/path';
const path = process.argv[2];
if (!path)
  throw new Error(
    'Pass a private catalog JSON path. Do not commit source material.',
  );
const graph = graphSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
const assert = (value: unknown, message: string) => {
  if (!value) throw new Error(message);
};
assert(
  graph.sources.length >= 8 &&
    graph.nodes.length >= 6 &&
    graph.edges.length >= 8,
  'Publication minimum not met',
);
for (const group of [graph.nodes, graph.edges, graph.sources])
  assert(new Set(group.map((x) => x.id)).size === group.length, 'Duplicate ID');
for (const source of graph.sources) {
  assert(
    source.excerpt.length > 4 && source.excerpt.length <= 120,
    `Excerpt length: ${source.id}`,
  );
  assert(
    source.author && source.title && source.guide && source.scope,
    `Missing context: ${source.id}`,
  );
  assert(
    !Number.isNaN(Date.parse(source.fetchedAt)),
    `Missing time: ${source.id}`,
  );
}
for (const node of graph.nodes) {
  assert(
    node.sourceIds.length &&
      node.sourceIds.every((id) => graph.sources.some((s) => s.id === id)),
    `Unsupported node ${node.id}`,
  );
  assert(
    graph.edges.filter((e) => e.fromId === node.id).length <= 3,
    `Too many recommendations: ${node.id}`,
  );
}
for (const edge of graph.edges) {
  const from = graph.nodes.find((n) => n.id === edge.fromId);
  const to = graph.nodes.find((n) => n.id === edge.toId);
  assert(from && to && from.id !== to.id, `Missing endpoint ${edge.id}`);
  assert(
    edge.sourceIds.length >= 2 && edge.reason.length > 12,
    `Missing evidence ${edge.id}`,
  );
  assert(
    edge.sourceIds.every((id) => graph.sources.some((s) => s.id === id)),
    `Missing source ${edge.id}`,
  );
  assert(
    edge.sourceIds.some((id) => from!.sourceIds.includes(id)) &&
      edge.sourceIds.some((id) => to!.sourceIds.includes(id)),
    `Both endpoints need evidence: ${edge.id}`,
  );
}
for (const journey of graph.journeys)
  assert(
    parsePath(journey.nodeIds.join('.'), graph),
    `Broken journey: ${journey.id}`,
  );
process.stdout.write(
  JSON.stringify({
    valid: true,
    version: graph.version,
    sources: graph.sources.length,
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    journeys: graph.journeys.length,
  }) + '\n',
);
