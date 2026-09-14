import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';
import { z } from 'zod';
import { requireDemoUser } from '../zhihu-demo/zhihu-demo.controller';
import { ZhihuOAuthService } from './zhihu-oauth.service';

const startSchema = z
  .object({ proof: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
const completionSchema = z
  .object({
    code: z.string().min(1).max(4096),
    state: z.string().max(4096),
    ticket: z.string().min(1).max(4096),
    verifier: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

@Controller('api/zhihu-oauth')
export class ZhihuOAuthController {
  constructor(private readonly service: ZhihuOAuthService) {}

  @Get('status')
  @Header('Cache-Control', 'private, no-store')
  status(@Req() req: Request) {
    return this.service.status(
      Boolean(req.userContext?.userId && !req.userContext.isSystemAccount),
    );
  }

  @Post('start')
  @NeedLogin()
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  start(@Req() req: Request, @Body() body: unknown) {
    const userId: string = requireDemoUser(req.userContext);
    const parsed = startSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException('无法发起连接，请刷新页面重试。');
    return this.service.start(userId, parsed.data.proof);
  }

  @Post('complete')
  @NeedLogin()
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  complete(@Req() req: Request, @Body() body: unknown) {
    const userId: string = requireDemoUser(req.userContext);
    const parsed = completionSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException('授权信息不完整，请重新连接知乎。');
    return this.service.complete(userId, {
      code: parsed.data.code,
      state: parsed.data.state,
      ticket: parsed.data.ticket,
      verifier: parsed.data.verifier,
    });
  }
}
