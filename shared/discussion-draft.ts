import { z } from 'zod';
import type { PublicQuestion } from './question-graph';

const draftSchema = z.object({
  body: z.string().max(2000),
  kind: z.enum(['question', 'experience']),
  sourceId: z.string().max(200).nullable(),
});
export type DiscussionDraft = z.infer<typeof draftSchema>;
export const emptyDiscussionDraft = (): DiscussionDraft => ({
  body: '',
  kind: 'question',
  sourceId: null,
});
export const discussionDraftKey = (questionId: string) =>
  `zhilu-discussion-draft-v1:${questionId}`;
export function readDiscussionDraft(
  raw: string | null,
  question: PublicQuestion,
): DiscussionDraft {
  try {
    const draft = draftSchema.parse(JSON.parse(raw || 'null'));
    return {
      ...draft,
      sourceId: question.sources.some((s) => s.id === draft.sourceId)
        ? draft.sourceId
        : null,
    };
  } catch {
    return emptyDiscussionDraft();
  }
}
