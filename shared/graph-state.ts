import { z } from 'zod';
import {
  graphShareSchema,
  publicQuestionSchema,
  questionLinkSchema,
  type PublicQuestion,
  type QuestionGraph,
  type QuestionLink,
  type GraphShare,
} from './question-graph';

const pointSchema = z.object({
  x: z.number().finite().min(-50000).max(50000),
  y: z.number().finite().min(-50000).max(50000),
});
export const explorationSchema = z
  .object({
    questions: z.array(publicQuestionSchema).max(60),
    links: z.array(questionLinkSchema).max(120),
    visible: z.array(z.string()).max(60),
    expanded: z.array(z.string()).max(60),
    positions: z.record(pointSchema),
    path: z.array(z.string()).min(1).max(100),
    scrolls: z.record(z.number().min(0).max(100000)),
  })
  .refine(
    (s) =>
      s.visible.length > 0 &&
      s.path.every((id) => s.visible.includes(id)) &&
      s.visible.every((id) => s.questions.some((q) => q.id === id)),
  );
export type Exploration = z.infer<typeof explorationSchema>;
export function addBranch(
  state: Exploration,
  parent: string,
  questions: PublicQuestion[],
  links: QuestionLink[],
): Exploration {
  const next: Exploration = {
    ...state,
    questions: [...state.questions],
    links: [...state.links],
    visible: [...state.visible],
    expanded: [...new Set([...state.expanded, parent])],
    positions: { ...state.positions },
  };
  const origin = next.positions[parent] || { x: 0, y: 0 };
  for (const q of questions.slice(0, 5)) {
    if (
      !next.questions.some((n) => n.id === q.id) &&
      next.questions.length < 60
    )
      next.questions.push(q);
    if (!next.questions.some((n) => n.id === q.id)) continue;
    if (!next.visible.includes(q.id)) next.visible.push(q.id);
    if (!next.positions[q.id]) {
      const x = origin.x + 320;
      let y = origin.y - (questions.length - 1) * 90;
      while (
        Object.values(next.positions).some(
          (p) => Math.abs(p.x - x) < 260 && Math.abs(p.y - y) < 180,
        )
      )
        y += 180;
      next.positions[q.id] = { x, y };
    }
  }
  for (const link of links) {
    if (
      link.fromId === parent &&
      next.visible.includes(link.toId) &&
      !next.links.some(
        (l) => l.fromId === link.fromId && l.toId === link.toId,
      ) &&
      next.links.length < 120
    )
      next.links.push(link);
  }
  return next;
}
export function startExploration(
  graph: QuestionGraph,
  root: string,
): Exploration {
  const question =
    graph.questions.find((q) => q.id === root) || graph.questions[0];
  let state: Exploration = {
    questions: [question],
    links: [],
    visible: [question.id],
    expanded: [],
    positions: { [question.id]: { x: 0, y: 180 } },
    path: [question.id],
    scrolls: {},
  };
  const branch = (id: string) => {
    const links = graph.links.filter((l) => l.fromId === id).slice(0, 5);
    state = addBranch(
      state,
      id,
      links
        .map((l) => graph.questions.find((q) => q.id === l.toId)!)
        .filter(Boolean),
      links,
    );
  };
  branch(question.id);
  const first = state.links[0]?.toId;
  if (first) branch(first);
  return state;
}
export function selectQuestion(state: Exploration, id: string): Exploration {
  if (!state.visible.includes(id) || state.path.at(-1) === id) return state;
  return { ...state, path: [...state.path, id].slice(-100) };
}
export function collapseBranch(state: Exploration, id: string): Exploration {
  const expanded = state.expanded.filter((n) => n !== id);
  const visible = new Set([state.path[0], id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const link of state.links)
      if (
        visible.has(link.fromId) &&
        expanded.includes(link.fromId) &&
        !visible.has(link.toId)
      ) {
        visible.add(link.toId);
        changed = true;
      }
  }
  return {
    ...state,
    expanded,
    visible: [...visible],
    path: [...state.path.filter((n) => visible.has(n))],
  };
}
export function toShare(state: Exploration): GraphShare {
  return graphShareSchema.parse({
    v: 2,
    ids: state.visible,
    links: state.links
      .filter(
        (l) =>
          state.visible.includes(l.fromId) &&
          state.visible.includes(l.toId) &&
          state.expanded.includes(l.fromId),
      )
      .map((l) => [l.fromId, l.toId]),
    path: state.path,
  });
}
export function parseShare(value: string): GraphShare | null {
  try {
    return graphShareSchema.parse(JSON.parse(value));
  } catch {
    return null;
  }
}
export function restoreShare(
  share: GraphShare,
  questions: PublicQuestion[],
  graph: QuestionGraph,
): Exploration {
  const ids = share.ids.filter((id) => questions.some((q) => q.id === id));
  const path = share.path.filter((id) => ids.includes(id));
  if (!path.length)
    return startExploration(graph, graph.journeys[0].questionIds[0]);
  const links: QuestionLink[] = share.links
    .filter(([a, b]) => ids.includes(a) && ids.includes(b))
    .map(
      ([a, b]) =>
        graph.links.find((l) => l.fromId === a && l.toId === b) || {
          id: `search-${a}-${b}`,
          fromId: a,
          toId: b,
          kind: '检索关联',
          basis: '检索关联',
          reason: '分享者探索时保留的检索关联，未经精选关系核对。',
          evidence: [],
        },
    );
  const positions: Exploration['positions'] = {};
  ids.forEach((id, i) => {
    const parent = links.find((l) => l.toId === id && positions[l.fromId]);
    const x = parent ? positions[parent.fromId].x + 320 : 0;
    let y = 180;
    while (
      Object.values(positions).some((p) => p.x === x && Math.abs(p.y - y) < 180)
    )
      y += 180;
    positions[id] = { x, y: i ? y : 180 };
  });
  return {
    questions: questions.filter((q) => ids.includes(q.id)),
    links,
    visible: ids,
    expanded: [...new Set(links.map((l) => l.fromId))],
    positions,
    path,
    scrolls: {},
  };
}
