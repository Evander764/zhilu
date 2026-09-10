import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { QuestionGraphService } from './question-graph.service';

@Controller('api/zhilu/v2')
export class QuestionGraphController {
  constructor(private readonly service: QuestionGraphService) {}
  @Get('graph') graph() {
    return this.service.graph();
  }
  @Get('questions/:id') question(@Param('id') id: string) {
    return this.service.question(id);
  }
  @Post('search')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  search(@Body() input: unknown) {
    return this.service.search(input);
  }
  @Post('questions/:id/expand')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  expand(@Param('id') id: string, @Body() input: unknown) {
    return this.service.expand(id, input);
  }
}
