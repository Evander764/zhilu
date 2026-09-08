import type { Connection, Graph } from './api.interface';
import { parsePath } from './path';

export function roadmapReadingPath(
  graph: Graph,
  journeyId: string,
  nodeId: string,
): string[] {
  if (!graph.nodes.some((node) => node.id === nodeId)) return [];
  const journey = graph.journeys.find((item) => item.id === journeyId);
  const index = journey?.nodeIds.indexOf(nodeId) ?? -1;
  const prefix =
    journey && index >= 0 ? journey.nodeIds.slice(0, index + 1) : [nodeId];
  return parsePath(prefix.join('.'), graph) || [nodeId];
}

export function roadmapConnections(
  graph: Graph,
  journeyId: string,
  nodeId: string,
) {
  const journey = graph.journeys.find((item) => item.id === journeyId);
  const result: { edge: Connection; primary: boolean }[] = [];
  const pairs = new Set<string>();
  const add = (edge: Connection | undefined, primary: boolean) => {
    if (
      !edge ||
      !graph.nodes.some((node) => node.id === edge.fromId) ||
      !graph.nodes.some((node) => node.id === edge.toId)
    )
      return;
    // Context must not draw a reverse arrow over a selected journey's arrow.
    const pair = [edge.fromId, edge.toId].sort().join(':');
    if (pairs.has(pair)) return;
    pairs.add(pair);
    result.push({ edge, primary });
  };
  journey?.nodeIds.slice(1).forEach((id, index) => {
    add(
      graph.edges.find(
        (edge) => edge.fromId === journey.nodeIds[index] && edge.toId === id,
      ),
      true,
    );
  });
  graph.edges
    .filter((edge) => edge.fromId === nodeId)
    .slice(0, 3)
    .forEach((edge) => add(edge, !journey));
  // Stable orientation landmarks. Only existing catalog relationships are drawn.
  for (const [from, to] of [
    ['goal', 'practice'],
    ['paid', 'goal'],
    ['practice', 'ai'],
  ]) {
    add(
      graph.edges.find((edge) => edge.fromId === from && edge.toId === to),
      false,
    );
  }
  return result;
}
