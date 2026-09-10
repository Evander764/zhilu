import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { ZhiluService } from './zhilu.service';

@Controller('api/zhilu')
export class ZhiluController {
  constructor(private readonly service: ZhiluService) {}

  @Get('graph')
  graph() {
    return this.service.graph();
  }

  @Get('status')
  @Header('Cache-Control', 'no-store')
  async status() {
    const graph = await this.service.graph();
    return {
      ok: true,
      version: graph.version,
      searchEnabled: this.service.searchEnabled(),
      sources: graph.sources.length,
    };
  }

  // POST keeps free-text searches out of URL/access-log query strings.
  @Post('search')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  search(@Body() input: unknown) {
    return this.service.search(input);
  }

  @Get('nodes/:id')
  node(@Param('id') id: string) {
    return this.service.node(id);
  }
}
