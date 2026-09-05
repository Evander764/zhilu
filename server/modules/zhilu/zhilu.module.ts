import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ZhiluController } from './zhilu.controller';
import { ZhiluService } from './zhilu.service';

@Module({
  imports: [HttpModule],
  controllers: [ZhiluController],
  providers: [ZhiluService],
})
export class ZhiluModule {}
