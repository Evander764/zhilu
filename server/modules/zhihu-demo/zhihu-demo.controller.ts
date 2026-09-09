import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Put,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';
import { ZhihuDemoService } from './zhihu-demo.service';
import {
  DEMO_ARTICLES,
  demoActivityKindSchema,
  demoProfileInputSchema,
} from '../../../shared/zhihu-demo';

// Only gateway-verified request context determines ownership. Never accept an owner in input.
export function requireDemoUser(context?: {
  userId?: string;
  isSystemAccount?: boolean;
}): string {
  if (!context?.userId || context.isSystemAccount)
    throw new UnauthorizedException('请先登录');
  return context.userId;
}

@Controller('api/zhihu-demo')
export class ZhihuDemoController {
  constructor(private readonly service: ZhihuDemoService) {}

  @Get('articles')
  articles() {
    return { items: DEMO_ARTICLES, contentMode: 'original-demo' };
  }

  @Get('me')
  @Header('Cache-Control', 'private, no-store')
  async account(@Req() req: Request) {
    if (!req.userContext?.userId || req.userContext.isSystemAccount)
      return { account: null };
    return {
      account: await this.service.account(
        requireDemoUser(req.userContext),
        req.userContext.userName,
      ),
    };
  }

  @Put('me/profile')
  @NeedLogin()
  @Header('Cache-Control', 'private, no-store')
  profile(@Req() req: Request, @Body() body: unknown) {
    const userId = requireDemoUser(req.userContext);
    const result = demoProfileInputSchema.safeParse(body);
    if (!result.success)
      throw new BadRequestException('请检查昵称、简介和偏好设置');
    return this.service.saveProfile(userId, result.data);
  }

  @Get('me/export')
  @NeedLogin()
  @Header('Cache-Control', 'private, no-store')
  export(@Req() req: Request) {
    return this.service.account(
      requireDemoUser(req.userContext),
      req.userContext.userName,
    );
  }

  @Delete('me/history')
  @NeedLogin()
  clearHistory(@Req() req: Request) {
    return this.service.clearHistory(requireDemoUser(req.userContext));
  }

  @Put('me/activity/:kind/:targetId')
  @NeedLogin()
  add(
    @Req() req: Request,
    @Param('kind') kind: string,
    @Param('targetId') targetId: string,
  ) {
    const parsed = demoActivityKindSchema.safeParse(kind);
    if (!parsed.success) throw new BadRequestException('不支持的记录类型');
    return this.service.setActivity(
      requireDemoUser(req.userContext),
      parsed.data,
      targetId,
      true,
    );
  }

  @Delete('me/activity/:kind/:targetId')
  @NeedLogin()
  remove(
    @Req() req: Request,
    @Param('kind') kind: string,
    @Param('targetId') targetId: string,
  ) {
    const parsed = demoActivityKindSchema.safeParse(kind);
    if (!parsed.success) throw new BadRequestException('不支持的记录类型');
    return this.service.setActivity(
      requireDemoUser(req.userContext),
      parsed.data,
      targetId,
      false,
    );
  }
}
