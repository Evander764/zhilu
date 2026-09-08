import type { Graph } from '../../shared/api.interface';
import { roadmapConnections, roadmapReadingPath } from '../../shared/roadmap';

// Deliberately incomplete relationships test the boundary between a visual route and a valid reading path.
const graph = {
  nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
  edges: [
    { id: 'ab', fromId: 'a', toId: 'b' },
    { id: 'ba', fromId: 'b', toId: 'a' },
  ],
  journeys: [{ id: 'route', nodeIds: ['a', 'b', 'c'] }],
} as Graph;

describe('roadmap reading integrity', () => {
  test('a selected destination retains only a connected journey prefix', () => {
    expect(roadmapReadingPath(graph, 'route', 'b')).toEqual(['a', 'b']);
    expect(roadmapReadingPath(graph, 'route', 'c')).toEqual(['c']);
    expect(roadmapReadingPath(graph, 'route', 'missing')).toEqual([]);
  });
  test('visual connections never invent a missing journey edge or overlay its reverse', () => {
    const connections = roadmapConnections(graph, 'route', 'b');
    expect(connections).toEqual([{ edge: graph.edges[0], primary: true }]);
    expect(connections.every(({ edge }) => graph.edges.includes(edge))).toBe(
      true,
    );
  });
});
