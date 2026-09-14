import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ZhiluController } from './zhilu.controller';
import { ZhiluService } from './zhilu.service';
import { QuestionGraphController } from './question-graph.controller';
import { QuestionGraphService } from './question-graph.service';
import { RelatedController } from './related.controller';

@Module({
  imports: [HttpModule],
  controllers: [ZhiluController, QuestionGraphController, RelatedController],
  providers: [ZhiluService, QuestionGraphService],
})
export class ZhiluModule {}
