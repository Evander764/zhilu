import { readFileSync } from 'node:fs';
import { questionGraphSchema } from '../../shared/question-graph';
const graph = questionGraphSchema.parse(
  JSON.parse(readFileSync(process.argv[2], 'utf8')),
);
const sources = new Map(
  graph.questions.flatMap((q) => q.sources.map((s) => [s.id, s] as const)),
);
const ids = new Set(graph.questions.map((q) => q.id));
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
assert(ids.size === graph.questions.length, 'duplicate questions');
assert(
  ids.size >= 6 && sources.size >= 8 && graph.links.length >= 8,
  'minimum publication content not met',
);
for (const question of graph.questions) {
  assert(
    question.origin === 'curated',
    'unreviewed search result in curated graph',
  );
  assert(
    question.sources.some((s) =>
      new URL(s.url).pathname.startsWith(`/question/${question.id}/`),
    ),
    'question lacks own answer',
  );
}
for (const link of graph.links) {
  assert(
    ids.has(link.fromId) && ids.has(link.toId) && link.fromId !== link.toId,
    'dangling link',
  );
  assert(
    link.basis === '编辑整理关系' &&
      link.reason.length > 10 &&
      link.evidence.length >= 2,
    'missing relationship review',
  );
  for (const evidence of link.evidence)
    assert(
      sources.get(evidence.sourceId)?.excerpt === evidence.excerpt,
      'evidence mismatch',
    );
  for (const id of [link.fromId, link.toId])
    assert(
      graph.questions
        .find((q) => q.id === id)!
        .sources.some((s) => link.evidence.some((e) => e.sourceId === s.id)),
      'missing endpoint evidence',
    );
}
assert(graph.journeys.length >= 3, 'missing demo paths');
for (const journey of graph.journeys)
  for (let i = 1; i < journey.questionIds.length; i++)
    assert(
      graph.links.some(
        (l) =>
          l.fromId === journey.questionIds[i - 1] &&
          l.toId === journey.questionIds[i],
      ),
      'broken demo path',
    );
process.stdout.write(
  JSON.stringify({
    questions: ids.size,
    sources: sources.size,
    links: graph.links.length,
    journeys: graph.journeys.length,
    status: 'content_structure_pass',
  }) + '\n',
);
