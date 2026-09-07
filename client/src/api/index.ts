import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
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
