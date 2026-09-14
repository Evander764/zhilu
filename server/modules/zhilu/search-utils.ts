import { z } from 'zod';
import type { SearchItem } from '../../../shared/api.interface';

export const searchInput = z.object({
  query: z.string().trim().min(2).max(120),
  nodeId: z.string().max(40).optional(),
});
export const upstreamSchema = z
  .object({
    Code: z.number(),
    Data: z
      .object({
        Items: z
          .array(
            z.object({
              Title: z.string(),
              AuthorName: z.string().optional(),
              ContentText: z.string(),
              Url: z.string(),
              ContentType: z.string().optional(),
              ContentID: z.string().optional(),
            }),
          )
          .optional(),
      })
      .nullable()
      .optional(),
  })
  .refine(
    (value) => value.Code !== 0 || Array.isArray(value.Data?.Items),
    'Missing search items',
  );
export function safeZhihuUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      ['www.zhihu.com', 'zhihu.com', 'zhuanlan.zhihu.com'].includes(
        url.hostname,
      ) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
export function plainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}
export function normalizeItems(
  data: z.infer<typeof upstreamSchema>,
): SearchItem[] {
  const seen = new Set<string>();
  return (data.Data?.Items || [])
    .filter((item) => {
      if (!safeZhihuUrl(item.Url)) return false;
      const key = new URL(item.Url).pathname;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10)
    .map((item) => ({
      title: plainText(item.Title),
      author: plainText(item.AuthorName || '知乎用户'),
      excerpt: plainText(item.ContentText).slice(0, 600),
      url: item.Url,
      ...(item.ContentType ? { contentType: item.ContentType } : {}),
      ...(item.ContentID ? { contentId: item.ContentID } : {}),
    }));
}
export function shanghaiDay(now = new Date()): string {
  return new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
}
