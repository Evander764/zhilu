import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { eq, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import { zhiluCatalog } from '../../database/schema';
import {
  graphSchema,
  type Graph,
  type NodeDetail,
  type SearchResult,
} from '../../../shared/api.interface';
import { normalizeItems, searchInput, upstreamSchema } from './search-utils';

@Injectable()
export class ZhiluService {
  private readonly logger = new Logger(ZhiluService.name);
  private graphCache: { value: Graph; expires: number } | null = null;
  private readonly searchCache = new Map<
    string,
    { value: SearchResult; expires: number }
  >();
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly http: HttpService,
  ) {}

  searchEnabled(): boolean {
    return (
      process.env.ZHILU_SEARCH_ENABLED !== 'false' &&
      Boolean(process.env.ZHIHU_ACCESS_SECRET)
    );
  }

  async graph(): Promise<Graph> {
    if (this.graphCache && this.graphCache.expires > Date.now())
      return this.graphCache.value;
    try {
      const rows = await this.db
        .select({ payload: zhiluCatalog.payload })
        .from(zhiluCatalog)
        .where(eq(zhiluCatalog.catalogKey, 'main'))
        .limit(1);
      if (!rows.length) throw new Error('missing_catalog');
      const value = graphSchema.parse(JSON.parse(rows[0].payload));
      this.graphCache = { value, expires: Date.now() + 60000 };
      return value;
    } catch {
      this.logger.error('catalog_unavailable');
      throw new ServiceUnavailableException(
        '阅读资料暂时无法加载，请稍后重试。',
      );
    }
  }

  async node(id: string): Promise<NodeDetail> {
    const graph = await this.graph();
    const node = graph.nodes.find((entry) => entry.id === id);
    if (!node) throw new NotFoundException('这条路径不存在，请回到起点选择。');
    return {
      node,
      sources: graph.sources.filter((source) =>
        node.sourceIds.includes(source.id),
      ),
      edges: graph.edges.filter((edge) => edge.fromId === id),
    };
  }

  private async reserveRequest(): Promise<void> {
    const rawLimit = Number(process.env.ZHILU_DAILY_SEARCH_LIMIT || 200);
    const limit = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(200, Math.floor(rawLimit)))
      : 200;
    // Narrow DB function grants slot consumption only, never table editing/reset.
    const rows = await this.db.execute(
      sql`SELECT zhilu_reserve_search(${limit}::integer) AS status`,
    );
    const status = rows[0]?.status;
    if (status === 'burst')
      throw new HttpException(
        '搜索请求较密，请等两秒再试。精选路径仍可阅读。',
        429,
      );
    if (status === 'quota')
      throw new HttpException(
        '今天的实时搜索次数已用完，明天恢复。精选路径仍可阅读。',
        429,
      );
    if (status !== 'allowed')
      throw new ServiceUnavailableException(
        '搜索额度服务暂不可用，精选路径仍可阅读。',
      );
  }

  async search(input: unknown): Promise<SearchResult> {
    const parsed = searchInput.safeParse(input);
    if (!parsed.success)
      throw new BadRequestException('请输入 2—120 个字符的问题。');
    if (!this.searchEnabled())
      throw new ServiceUnavailableException(
        '实时搜索暂未开放，精选路径仍可阅读。',
      );
    const { query, nodeId } = parsed.data;
    const context = nodeId ? (await this.node(nodeId)).node.stage : '';
    const combined = `${query} ${context}`.trim();
    const key = createHash('sha256').update(combined).digest('hex');
    const cached = this.searchCache.get(key);
    if (cached && cached.expires > Date.now())
      return { ...cached.value, cached: true };
    try {
      await this.reserveRequest();
      const response = await this.http.axiosRef.get<unknown>(
        'https://developer.zhihu.com/api/v1/content/zhihu_search',
        {
          params: { Query: combined, Count: 10 },
          timeout: 12000,
          maxRedirects: 0,
          headers: {
            Authorization: `Bearer ${process.env.ZHIHU_ACCESS_SECRET}`,
            'X-Request-Timestamp': String(Math.floor(Date.now() / 1000)),
          },
        },
      );
      const parsedResponse = upstreamSchema.safeParse(response.data);
      if (!parsedResponse.success)
        throw new ServiceUnavailableException('搜索返回格式异常，请稍后重试。');
      if (parsedResponse.data.Code === 30001)
        throw new HttpException(
          '知乎搜索暂时限流，请稍后重试。精选路径仍可阅读。',
          429,
        );
      if (parsedResponse.data.Code !== 0)
        throw new ServiceUnavailableException(
          '知乎搜索暂不可用，精选路径仍可阅读。',
        );
      const value: SearchResult = {
        items: normalizeItems(parsedResponse.data),
        cached: false,
        fetchedAt: new Date().toISOString(),
      };
      for (const [cacheKey, entry] of this.searchCache)
        if (entry.expires < Date.now()) this.searchCache.delete(cacheKey);
      if (this.searchCache.size >= 100)
        this.searchCache.delete(this.searchCache.keys().next().value!);
      this.searchCache.set(key, { value, expires: Date.now() + 300000 });
      return value;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Never log Axios errors: they contain Authorization and user search text.
      const cause = error as { code?: string; cause?: { code?: string } };
      const code = cause.cause?.code || cause.code || 'unknown';
      this.logger.warn(
        `search_unavailable:${/^[A-Z0-9_]{3,24}$/.test(code) ? code : 'unknown'}`,
      );
      throw new ServiceUnavailableException(
        '搜索未能完成，请稍后重试。精选路径仍可阅读。',
      );
    }
  }
}
