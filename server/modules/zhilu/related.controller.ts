import {
  BadRequestException,
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
} from '@nestjs/common';
import {
  buildRelatedTree,
  relatedRequestSchema,
} from '../../../shared/related-tree';
import type { RelatedTree } from '../../../shared/api.interface';
import { ZhiluService } from './zhilu.service';

@Controller('api/zhilu/related')
export class RelatedController {
  constructor(private readonly service: ZhiluService) {}

  // Public search, no personal writes. Keep titles out of access-log URLs.
  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async search(@Body() input: unknown): Promise<RelatedTree> {
    const request = relatedRequestSchema.safeParse(input);
    if (!request.success)
      throw new BadRequestException(
        '请输入 2—120 个字符的问题，且使用有效的问题编号。',
      );
    // Demo IDs must never enter the old catalog lookup or personal activity API.
    const result = await this.service.search({ query: request.data.query });
    return buildRelatedTree(request.data, result);
  }
}
