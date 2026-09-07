import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ZhiluController } from './zhilu.controller';
import { ZhiluService } from './zhilu.service';
import { QuestionGraphController } from './question-graph.controller';
import { QuestionGraphService } from './question-graph.service';

@Module({
  imports: [HttpModule],
  controllers: [ZhiluController, QuestionGraphController],
  providers: [ZhiluService, QuestionGraphService],
})
export class ZhiluModule {}
