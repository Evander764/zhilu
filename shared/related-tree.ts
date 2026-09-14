import { z } from 'zod';

export const relatedIdSchema = z.string().regex(/^[1-9][0-9]{0,24}$/);
export const relatedQuerySchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .refine((value) => !/[\p{Cc}\p{Cf}]/u.test(value), 'Invalid query');
export const relatedRequestSchema = z
  .object({
    query: relatedQuerySchema,
    questionId: relatedIdSchema.optional(),
  })
  .strict();
export type RelatedRequest = z.infer<typeof relatedRequestSchema>;

export interface RelatedSource {
  title: string;
  author: string;
  excerpt: string;
  url: string;
  coverage: '搜索片段';
  upstreamContentId?: string;
}
export interface RelatedAnswer extends RelatedSource {
  kind: 'answer';
  answerId: string;
  questionId: string;
}
export interface RelatedQuestion {
  kind: 'question';
  questionId: string;
  title: string;
  url: string;
  source?: RelatedSource;
  answers: RelatedAnswer[];
}
export interface RelatedArticle extends RelatedSource {
  kind: 'article';
  articleId: string;
}
export interface RelatedTree {
  root: { title: string; questionId: string | null; url: string | null };
  questions: RelatedQuestion[];
  articles: RelatedArticle[];
  cached: boolean;
  fetchedAt: string;
  relation: '搜索相关';
}
export interface RelatedSearchItem {
  title: string;
  author: string;
  excerpt: string;
  url: string;
  contentType?: string;
  contentId?: string;
}
export interface RelatedLocation {
  kind: 'question' | 'answer' | 'article';
  contentId: string;
  questionId?: string;
  url: string;
}

// Accept only public content routes, never redirects, credentials or arbitrary URLs.
// Keep the original safe URL (including official attribution query parameters).
export function parseRelatedUrl(value: string): RelatedLocation | null {
  if (value.length > 2048 || /[\s\\\p{Cc}\p{Cf}]/u.test(value)) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.port || u.username || u.password)
      return null;
    if (['www.zhihu.com', 'zhihu.com'].includes(u.hostname)) {
      const match =
        /^\/question\/([1-9][0-9]{0,24})(?:\/answer\/([1-9][0-9]{0,24}))?\/?$/.exec(
          u.pathname,
        );
      if (!match) return null;
      return {
        kind: match[2] ? 'answer' : 'question',
        questionId: match[1],
        contentId: match[2] || match[1],
        url: u.href,
      };
    }
    const match = /^\/p\/([1-9][0-9]{0,24})\/?$/.exec(u.pathname);
    return u.hostname === 'zhuanlan.zhihu.com' && match
      ? { kind: 'article', contentId: match[1], url: u.href }
      : null;
  } catch {
    return null;
  }
}

const relatedSourceSchema = z.object({
  title: z.string().min(1).max(300),
  author: z.string().max(100),
  excerpt: z.string().max(600),
  url: z.string().refine((value) => Boolean(parseRelatedUrl(value))),
  coverage: z.literal('搜索片段'),
  upstreamContentId: z.string().max(100).optional(),
});
const relatedAnswerSchema = relatedSourceSchema
  .extend({
    kind: z.literal('answer'),
    answerId: relatedIdSchema,
    questionId: relatedIdSchema,
  })
  .refine((value) => {
    const url = parseRelatedUrl(value.url);
    return (
      url?.kind === 'answer' &&
      url.questionId === value.questionId &&
      url.contentId === value.answerId
    );
  });
export const relatedQuestionSchema = z
  .object({
    kind: z.literal('question'),
    questionId: relatedIdSchema,
    title: z.string().min(1).max(300),
    url: z.string(),
    source: relatedSourceSchema.optional(),
    answers: z.array(relatedAnswerSchema).max(10),
  })
  .refine((value) => {
    const url = parseRelatedUrl(value.url);
    return (
      url?.kind === 'question' &&
      url.questionId === value.questionId &&
      value.answers.every((answer) => answer.questionId === value.questionId)
    );
  });
export const relatedTreeSchema = z.object({
  root: z.object({
    title: relatedQuerySchema,
    questionId: relatedIdSchema.nullable(),
    url: z.string().nullable(),
  }),
  questions: z.array(relatedQuestionSchema).max(10),
  articles: z
    .array(
      relatedSourceSchema
        .extend({ kind: z.literal('article'), articleId: relatedIdSchema })
        .refine((value) => {
          const url = parseRelatedUrl(value.url);
          return url?.kind === 'article' && url.contentId === value.articleId;
        }),
    )
    .max(10),
  cached: z.boolean(),
  fetchedAt: z.string().datetime(),
  relation: z.literal('搜索相关'),
});

export function relatedQuestionPath(
  question: Pick<RelatedQuestion, 'questionId' | 'title'>,
): string {
  relatedIdSchema.parse(question.questionId);
  return `/question/${question.questionId}?title=${encodeURIComponent(question.title.slice(0, 300))}`;
}

export function relatedRouteRequest(
  id: string | undefined,
  title: string | null,
): RelatedRequest | null {
  if (!title || title.length > 300) return null;
  const result = relatedRequestSchema.safeParse({
    query: title.replace(/\s*-\s*知乎$/, '').slice(0, 120),
    questionId: id,
  });
  return result.success && id ? result.data : null;
}

export function buildRelatedTree(
  input: RelatedRequest,
  result: { items: RelatedSearchItem[]; cached: boolean; fetchedAt: string },
): RelatedTree {
  const request = relatedRequestSchema.parse(input);
  const questions = new Map<string, RelatedQuestion>();
  const articles: RelatedArticle[] = [];
  const seen = new Set<string>();
  for (const item of result.items.slice(0, 10)) {
    const location = parseRelatedUrl(item.url);
    if (!location || !item.title.trim()) continue;
    if (item.contentType && item.contentType.toLowerCase() !== location.kind)
      continue;
    const key = `${location.kind}:${location.contentId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const source: RelatedSource = {
      title: item.title.slice(0, 300),
      author: item.author.slice(0, 100),
      excerpt: item.excerpt.slice(0, 600),
      url: location.url,
      coverage: '搜索片段',
      ...(item.contentId
        ? { upstreamContentId: item.contentId.slice(0, 100) }
        : {}),
    };
    if (location.kind === 'article') {
      articles.push({
        ...source,
        kind: 'article',
        articleId: location.contentId,
      });
      continue;
    }
    const questionId = location.questionId!;
    const question: RelatedQuestion = questions.get(questionId) || {
      kind: 'question',
      questionId,
      title: source.title,
      url: `https://www.zhihu.com/question/${questionId}`,
      answers: [],
    };
    if (location.kind === 'answer') {
      question.answers.push({
        ...source,
        kind: 'answer',
        questionId,
        answerId: location.contentId,
      });
    } else {
      question.source = source;
    }
    questions.set(questionId, question);
  }
  return {
    root: {
      title: request.query,
      questionId: request.questionId || null,
      url: request.questionId
        ? `https://www.zhihu.com/question/${request.questionId}`
        : null,
    },
    questions: [...questions.values()],
    articles,
    cached: result.cached,
    fetchedAt: result.fetchedAt,
    relation: '搜索相关',
  };
}
