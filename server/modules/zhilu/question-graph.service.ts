import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { zhiluCatalog } from '../../database/schema';
import { ZhiluService } from './zhilu.service';
import {
  publicQuestionSchema,
  questionGraphSchema,
  questionIdSchema,
  questionsFromSearch,
  type PublicQuestion,
  type QuestionGraph,
  type QuestionSearchResult,
  type QuestionExpansion,
} from '../../../shared/question-graph';

@Injectable()
export class QuestionGraphService {
  private readonly logger = new Logger(QuestionGraphService.name);
  private cache: { graph: QuestionGraph; expires: number } | null = null;
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly searchService: ZhiluService,
  ) {}

  async graph(): Promise<QuestionGraph> {
    if (this.cache && this.cache.expires > Date.now()) return this.cache.graph;
    const rows = await this.db
      .select({ payload: zhiluCatalog.payload })
      .from(zhiluCatalog)
      .where(eq(zhiluCatalog.catalogKey, 'questions-v2'))
      .limit(1);
    if (!rows.length)
      throw new ServiceUnavailableException(
        '问题图谱暂时无法加载，请稍后重试。',
      );
    const graph = questionGraphSchema.parse(JSON.parse(rows[0].payload));
    this.cache = { graph, expires: Date.now() + 60000 };
    return graph;
  }

  async question(id: string): Promise<PublicQuestion> {
    if (!questionIdSchema.safeParse(id).success)
      throw new BadRequestException('无效的问题编号。');
    const curated = (await this.graph()).questions.find((q) => q.id === id);
    if (curated) return curated;
    const rows = await this.db
      .select({ payload: zhiluCatalog.payload })
      .from(zhiluCatalog)
      .where(eq(zhiluCatalog.catalogKey, `question:${id}`))
      .limit(1);
    if (!rows.length)
      throw new NotFoundException('这条问题记录暂不可用，可以回到精选起点。');
    return publicQuestionSchema.parse(JSON.parse(rows[0].payload));
  }

  async search(input: unknown): Promise<QuestionSearchResult> {
    const parsed = z
      .object({ query: z.string().trim().min(2).max(120) })
      .safeParse(input);
    if (!parsed.success)
      throw new BadRequestException('请输入 2—120 个字符的问题。');
    const result = await this.searchService.search(parsed.data);
    const graph = await this.graph();
    const questions = questionsFromSearch(result).map(
      (q) => graph.questions.find((c) => c.id === q.id) || q,
    );
    // Only validated upstream records reach this bounded DB function. No public edit endpoint.
    for (const question of questions.filter((q) => q.origin === 'search')) {
      try {
        // The platform SQL transport cannot decode PostgreSQL void; return text.
        await this.db.execute(
          sql`SELECT zhilu_index_question(${question.id}::text, ${JSON.stringify(question)}::text)::text AS indexed`,
        );
      } catch (error) {
        const cause = error as {
          code?: string;
          message?: string;
          cause?: { code?: string; message?: string };
        };
        const code = cause.cause?.code || cause.code || 'unknown';
        this.logger.warn(
          `question_index_unavailable:${/^[A-Z0-9_]{3,24}$/.test(code) ? code : 'unknown'}`,
        );

        throw new ServiceUnavailableException(
          '搜索结果暂时无法保存，请稍后重试。已展开的图谱仍可阅读。',
        );
      }
    }
    return { questions, cached: result.cached, fetchedAt: result.fetchedAt };
  }

  async expand(id: string, input: unknown): Promise<QuestionExpansion> {
    const question = await this.question(id);
    const parsed = z
      .object({ query: z.string().trim().min(2).max(120).optional() })
      .safeParse(input);
    if (!parsed.success)
      throw new BadRequestException('请输入 2—120 个字符的问题。');
    const result = await this.search({
      query: parsed.data.query || question.title.slice(0, 120),
    });
    const questions = result.questions.filter((q) => q.id !== id).slice(0, 5);
    return {
      ...result,
      questions,
      links: questions.map((q) => ({
        id: `search-${id}-${q.id}`,
        fromId: id,
        toId: q.id,
        kind: '检索关联',
        basis: '检索关联',
        reason:
          '这是从当前问题发起检索后发现的问题。相似检索结果不代表前提、因果或步骤关系。',
        evidence: [],
      })),
    };
  }
}
