import { Module } from '@nestjs/common';
import { ZhihuDemoController } from './zhihu-demo.controller';
import { ZhihuDemoService } from './zhihu-demo.service';

@Module({ controllers: [ZhihuDemoController], providers: [ZhihuDemoService] })
export class ZhihuDemoModule {}
