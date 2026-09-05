import type { Graph } from './api.interface';

export function parsePath(value: string | null, graph: Graph): string[] | null {
  if (!value) return [];
  const ids = value.split('.');
  if (
    ids.length > 24 ||
    ids.some((id) => !graph.nodes.some((node) => node.id === id))
  )
    return null;
  for (let i = 1; i < ids.length; i++) {
    if (
      !graph.edges.some(
        (edge) => edge.fromId === ids[i - 1] && edge.toId === ids[i],
      )
    )
      return null;
  }
  return ids;
}
