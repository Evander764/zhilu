import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  DemoAccount,
  DemoActivityKind,
  DemoProfileInput,
} from '../../../shared/api.interface';

async function demoRequest<T>(
  path: string,
  method = 'GET',
  data?: unknown,
): Promise<T> {
  try {
    const response = await axiosForBackend({
      url: `/api/zhihu-demo/${path}`,
      method,
      data,
    });
    if (response.status >= 400)
      throw new Error(
        response.status === 401 ? '请先登录，再进行操作' : '操作未保存，请重试',
      );
    return response.data;
  } catch (error) {
    if (error instanceof Error && !('response' in error)) throw error;
    throw new Error('无法连接到账号服务，请检查网络后重试');
  }
}
export const getDemoAccount = () => demoRequest<DemoAccount | null>('me');
export const saveDemoProfile = (data: DemoProfileInput) =>
  demoRequest<DemoAccount>('me/profile', 'PUT', data);
export const setDemoActivity = (
  kind: DemoActivityKind,
  id: string,
  enabled: boolean,
) =>
  demoRequest<{ saved: boolean }>(
    `me/activity/${kind}/${encodeURIComponent(id)}`,
    enabled ? 'PUT' : 'DELETE',
  );
export const clearDemoHistory = () =>
  demoRequest<{ cleared: boolean }>('me/history', 'DELETE');
export const exportDemoAccount = () => demoRequest<DemoAccount>('me/export');
import type {
  QuestionGraph,
  PublicQuestion,
  QuestionSearchResult,
  QuestionExpansion,
} from '../../../shared/question-graph';

export async function getQuestionGraph(): Promise<QuestionGraph> {
  return (await axiosForBackend({ url: '/api/zhilu/v2/graph', method: 'GET' }))
    .data;
}
export async function getQuestion(id: string): Promise<PublicQuestion> {
  return (
    await axiosForBackend({
      url: `/api/zhilu/v2/questions/${encodeURIComponent(id)}`,
      method: 'GET',
    })
  ).data;
}
export async function searchQuestions(
  query: string,
): Promise<QuestionSearchResult> {
  return (
    await axiosForBackend({
      url: '/api/zhilu/v2/search',
      method: 'POST',
      data: { query },
    })
  ).data;
}
export async function expandQuestion(
  id: string,
  query: string,
): Promise<QuestionExpansion> {
  return (
    await axiosForBackend({
      url: `/api/zhilu/v2/questions/${encodeURIComponent(id)}/expand`,
      method: 'POST',
      data: { query },
    })
  ).data;
}
import type {
  Graph,
  NodeDetail,
  SearchRequest,
  SearchResult,
} from '../../../shared/api.interface';

export async function getGraph(): Promise<Graph> {
  return (await axiosForBackend({ url: '/api/zhilu/graph', method: 'GET' }))
    .data;
}
export async function getNode(id: string): Promise<NodeDetail> {
  return (
    await axiosForBackend({
      url: `/api/zhilu/nodes/${encodeURIComponent(id)}`,
      method: 'GET',
    })
  ).data;
}
export async function searchZhihu(data: SearchRequest): Promise<SearchResult> {
  return (
    await axiosForBackend({ url: '/api/zhilu/search', method: 'POST', data })
  ).data;
}
