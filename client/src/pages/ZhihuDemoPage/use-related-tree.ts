import { useEffect, useState } from 'react';
import { getRelatedTree } from '../../api';
import type {
  RelatedRequest,
  RelatedTree,
} from '../../../../shared/related-tree';
import {
  observeRelated,
  RelatedRequests,
  relatedErrorKind,
  visibilityForQuestion,
  type RelatedErrorKind,
} from './related-requests';
const requests = new RelatedRequests(getRelatedTree);
export function useRelatedVisibility(questionKey: string) {
  const [state, setState] = useState({ questionKey, open: true });
  const current = visibilityForQuestion(state, questionKey);
  // Reset during the identity-changing render: the new question is never disabled
  // by the previous question's close action, even before effects run.
  if (current !== state) setState(current);
  return {
    open: current.open,
    setOpen: (open: boolean) => setState({ questionKey, open }),
  };
}
export interface RelatedState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  tree?: RelatedTree;
  error?: RelatedErrorKind;
}
export function useRelatedTree(input: RelatedRequest | null, enabled: boolean) {
  const query = input?.query;
  const questionId = input?.questionId;
  const key = JSON.stringify(input);
  const [state, setState] = useState<RelatedState & { key?: string }>({
    status: 'idle',
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!query || !enabled) return;
    setState({ key, status: 'loading' });
    return observeRelated(
      requests.get({ query, ...(questionId ? { questionId } : {}) }),
      (tree) => setState({ key, status: 'ready', tree }),
      (error) =>
        setState({ key, status: 'error', error: relatedErrorKind(error) }),
    );
  }, [query, questionId, key, enabled, attempt]);
  const visible: RelatedState =
    state.key === key
      ? state
      : { status: query && enabled ? 'loading' : 'idle' };
  return {
    ...visible,
    retry: () => setAttempt((value) => value + 1),
    knownQuestion: questionId ? requests.knownQuestion(questionId) : undefined,
  };
}
