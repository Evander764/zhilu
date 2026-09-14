import type {
  RelatedQuestion,
  RelatedRequest,
  RelatedTree,
} from '../../../../shared/related-tree';
export type RelatedErrorKind =
  | 'auth'
  | 'rate'
  | 'service'
  | 'input'
  | 'network';
export interface RelatedVisibility {
  questionKey: string;
  open: boolean;
}
export function visibilityForQuestion(
  state: RelatedVisibility,
  questionKey: string,
): RelatedVisibility {
  return state.questionKey === questionKey
    ? state
    : { questionKey, open: true };
}
export function relatedErrorKind(error: unknown): RelatedErrorKind {
  const status = (error as { response?: { status?: number } })?.response
    ?.status;
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate';
  if (status === 400) return 'input';
  return status ||
    (error instanceof Error && error.message === 'RELATED_INVALID_RESPONSE')
    ? 'service'
    : 'network';
}

// Ephemeral public search cache only; never writes account data or browser storage.
export class RelatedRequests {
  private readonly cache = new Map<
    string,
    { tree: RelatedTree; expires: number }
  >();
  private readonly pending = new Map<string, Promise<RelatedTree>>();
  constructor(
    private readonly load: (input: RelatedRequest) => Promise<RelatedTree>,
    private readonly now = Date.now,
  ) {}
  get(input: RelatedRequest): Promise<RelatedTree> {
    const key = JSON.stringify(input);
    const cached = this.cache.get(key);
    if (cached && cached.expires > this.now())
      return Promise.resolve({ ...cached.tree, cached: true });
    const pending = this.pending.get(key);
    if (pending) return pending;
    const request = this.load(input)
      .then((tree) => {
        for (const [key, entry] of this.cache)
          if (entry.expires <= this.now()) this.cache.delete(key);
        if (this.cache.size >= 100)
          this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(key, { tree, expires: this.now() + 300000 });
        return tree;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }
  knownQuestion(id: string): RelatedQuestion | undefined {
    for (const entry of [...this.cache.values()].reverse()) {
      if (entry.expires <= this.now()) continue;
      const question = entry.tree.questions.find((q) => q.questionId === id);
      if (question) return question;
    }
    return undefined;
  }
}

// Each page subscription can be invalidated without aborting a shared request.
export function observeRelated(
  request: Promise<RelatedTree>,
  ready: (tree: RelatedTree) => void,
  failed: (error: unknown) => void,
): () => void {
  let active = true;
  void request.then(
    (tree) => {
      if (active) ready(tree);
    },
    (error) => {
      if (active) failed(error);
    },
  );
  return () => {
    active = false;
  };
}
