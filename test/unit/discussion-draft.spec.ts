import type { PublicQuestion } from '../../shared/question-graph';
import {
  discussionDraftKey,
  readDiscussionDraft,
} from '../../shared/discussion-draft';

const question = { id: '123', sources: [{ id: 'source-a' }] } as PublicQuestion;
describe('discussion draft isolation', () => {
  test('each question has its own draft key', () => {
    expect(discussionDraftKey('123')).not.toBe(discussionDraftKey('456'));
  });
  test('a saved quote can only reference a source on the current question', () => {
    const draft = {
      body: 'My question',
      kind: 'question',
      sourceId: 'source-a',
    };
    expect(readDiscussionDraft(JSON.stringify(draft), question)).toEqual(draft);
    expect(
      readDiscussionDraft(
        JSON.stringify({ ...draft, sourceId: 'another-question-source' }),
        question,
      ),
    ).toEqual({ ...draft, sourceId: null });
  });
  test.each([
    '{broken',
    JSON.stringify({
      body: 'x'.repeat(2001),
      kind: 'question',
      sourceId: null,
    }),
  ])('damaged or oversized storage cannot populate the composer', (raw) => {
    expect(readDiscussionDraft(raw, question).body).toBe('');
  });
});
