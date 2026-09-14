import { z } from 'zod';

export interface ZhihuOAuthStatus {
  version: string;
  appId: string;
  redirectUri: string;
  configured: boolean;
  callbackRegistered: boolean;
  ready: boolean;
  signedIn: boolean;
  message: string;
}
export interface ZhihuOAuthStart {
  authorizationUrl: string;
  ticket: string;
}
export interface ZhihuOAuthCompletionInput {
  code: string;
  state: string;
  ticket: string;
  verifier: string;
}
export interface ZhihuOAuthItem {
  title: string;
  summary: string;
  url: string | null;
}
export interface ZhihuOAuthDataResult {
  id: string;
  name: string;
  status: 'success' | 'empty' | 'error';
  message: string;
  item: ZhihuOAuthItem | null;
}
export interface ZhihuOAuthCompletion {
  authorized: true;
  readAt: string;
  results: ZhihuOAuthDataResult[];
}
export type { RelatedRequest, RelatedTree } from './related-tree';
export type {
  DemoAccount,
  DemoActivity,
  DemoActivityKind,
  DemoPreferences,
  DemoProfileInput,
  DemoArticle,
} from './zhihu-demo';

export const sourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string(),
  url: z
    .string()
    .url()
    .refine((value) => {
      const u = new URL(value);
      return (
        u.protocol === 'https:' &&
        ['www.zhihu.com', 'zhihu.com', 'zhuanlan.zhihu.com'].includes(
          u.hostname,
        ) &&
        !u.username &&
        !u.password
      );
    }, 'Only public Zhihu URLs are allowed'),
  excerpt: z.string(),
  guide: z.string(),
  scope: z.string(),
  label: z.string(),
  coverage: z.literal('搜索片段'),
  fetchedAt: z.string(),
  editedAt: z.number().optional(),
  availability: z.enum(['api-returned', 'unavailable']),
  checkedAt: z.string(),
});
export const nodeSchema = z.object({
  id: z.string(),
  stage: z.string(),
  title: z.string(),
  subtitle: z.string(),
  purpose: z.string(),
  sourceIds: z.array(z.string()),
  searchQuery: z.string(),
});
export const edgeSchema = z.object({
  id: z.string(),
  fromId: z.string(),
  toId: z.string(),
  kind: z.enum(['补充前提', '展开步骤', '不同条件下的替代路径']),
  label: z.string(),
  reason: z.string(),
  basis: z.literal('编辑整理关系'),
  sourceIds: z.array(z.string()),
  reviewed: z.literal(true),
});
export const graphSchema = z.object({
  version: z.string(),
  updatedAt: z.string(),
  nodes: z.array(nodeSchema),
  sources: z.array(sourceSchema),
  edges: z.array(edgeSchema),
  journeys: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      nodeIds: z.array(z.string()),
    }),
  ),
});
export type Source = z.infer<typeof sourceSchema>;
export type QuestionNode = z.infer<typeof nodeSchema>;
export type Connection = z.infer<typeof edgeSchema>;
export type Graph = z.infer<typeof graphSchema>;
export interface NodeDetail {
  node: QuestionNode;
  sources: Source[];
  edges: Connection[];
}
export interface SearchItem {
  title: string;
  author: string;
  excerpt: string;
  url: string;
  contentType?: string;
  contentId?: string;
}
export interface SearchResult {
  items: SearchItem[];
  cached: boolean;
  fetchedAt: string;
}
export interface SearchRequest {
  query: string;
  nodeId?: string;
}
