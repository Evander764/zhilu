import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ZhihuOAuthController } from './zhihu-oauth.controller';
import { ZhihuOAuthService } from './zhihu-oauth.service';

// A private Axios instance keeps OAuth payloads out of the platform's general HTTP logging interceptors.
@Module({
  imports: [HttpModule.register({})],
  controllers: [ZhihuOAuthController],
  providers: [ZhihuOAuthService],
})
export class ZhihuOAuthModule {}
