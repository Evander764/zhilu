import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
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
