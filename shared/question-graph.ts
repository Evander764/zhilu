import { z } from 'zod';
import { sourceSchema, type SearchResult } from './api.interface';

export const questionIdSchema = z.string().regex(/^[1-9][0-9]{0,24}$/);
export function questionIdFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      !['www.zhihu.com', 'zhihu.com'].includes(url.hostname) ||
      url.username ||
      url.password
    )
      return null;
    const match =
      /^\/question\/([1-9][0-9]{0,24})(?:\/answer\/[1-9][0-9]{0,24})?\/?$/.exec(
        url.pathname,
      );
    return match?.[1] || null;
  } catch {
    return null;
  }
}
export const publicQuestionSchema = z
  .object({
    id: questionIdSchema,
    title: z.string().min(1).max(300),
    url: z.string().url(),
    sources: z.array(sourceSchema).max(20),
    origin: z.enum(['curated', 'search']),
  })
  .refine(
    (q) => questionIdFromUrl(q.url) === q.id,
    'Question URL must match ID',
  );
export const questionLinkSchema = z.object({
  id: z.string().max(100),
  fromId: questionIdSchema,
  toId: questionIdSchema,
  kind: z.enum(['补充前提', '展开步骤', '不同条件下的替代路径', '检索关联']),
  reason: z.string().max(1000),
  basis: z.enum(['编辑整理关系', '检索关联']),
  evidence: z.array(z.object({ sourceId: z.string(), excerpt: z.string() })),
});
export const questionGraphSchema = z.object({
  version: z.string(),
  updatedAt: z.string(),
  questions: z.array(publicQuestionSchema),
  links: z.array(questionLinkSchema),
  journeys: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      questionIds: z.array(questionIdSchema),
    }),
  ),
});
export type PublicQuestion = z.infer<typeof publicQuestionSchema>;
export type QuestionLink = z.infer<typeof questionLinkSchema>;
export type QuestionGraph = z.infer<typeof questionGraphSchema>;
export interface QuestionSearchResult {
  questions: PublicQuestion[];
  cached: boolean;
  fetchedAt: string;
}
export interface QuestionExpansion extends QuestionSearchResult {
  links: QuestionLink[];
}
export const graphShareSchema = z
  .object({
    v: z.literal(2),
    ids: z.array(questionIdSchema).min(1).max(60),
    links: z.array(z.tuple([questionIdSchema, questionIdSchema])).max(120),
    path: z.array(questionIdSchema).min(1).max(100),
  })
  .strict()
  .refine(
    (s) =>
      s.path.every((id) => s.ids.includes(id)) &&
      s.links.every(
        ([a, b]) => a !== b && s.ids.includes(a) && s.ids.includes(b),
      ),
  );
export type GraphShare = z.infer<typeof graphShareSchema>;
export function questionsFromSearch(result: SearchResult): PublicQuestion[] {
  const map = new Map<string, PublicQuestion>();
  for (const item of result.items) {
    const id = questionIdFromUrl(item.url);
    if (!id) continue;
    const source = {
      id: `search-${id}-${new URL(item.url).pathname.split('/').pop()}`,
      title: item.title,
      author: item.author || '作者未返回',
      url: item.url,
      excerpt: item.excerpt,
      guide: '以下为知乎搜索返回的片段，请打开原文了解完整语境。',
      scope: '搜索发现，尚未经过精选关系核对。',
      label: '搜索发现',
      coverage: '搜索片段' as const,
      fetchedAt: result.fetchedAt,
      checkedAt: result.fetchedAt,
      availability: 'api-returned' as const,
    };
    const old = map.get(id);
    if (old) {
      if (!old.sources.some((s) => s.url === source.url))
        old.sources.push(source);
    } else
      map.set(id, {
        id,
        title: item.title.slice(0, 300),
        url: `https://www.zhihu.com/question/${id}`,
        sources: [source],
        origin: 'search',
      });
  }
  return [...map.values()];
}
