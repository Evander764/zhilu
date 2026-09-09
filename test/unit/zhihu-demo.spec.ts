import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import {
  ZhihuDemoController,
  requireDemoUser,
} from '../../server/modules/zhihu-demo/zhihu-demo.controller';
import { ZhihuDemoService } from '../../server/modules/zhihu-demo/zhihu-demo.service';
import { DEMO_ARTICLES, demoProfileInputSchema } from '../../shared/zhihu-demo';
import type { Request } from 'express';

describe('Zhihu demo account boundary', () => {
  const service = {
    account: jest.fn(),
    saveProfile: jest.fn(),
    setActivity: jest.fn(),
    clearHistory: jest.fn(),
  };
  const controller = new ZhihuDemoController(
    service as unknown as ZhihuDemoService,
  );
  const request = (id: string) =>
    ({
      userContext: { userId: id, userName: 'Reader', isSystemAccount: false },
    }) as Request;
  const profile = {
    displayName: 'Reader',
    bio: '',
    preferences: {
      recordHistory: true,
      emailNotifications: false,
      compactFeed: false,
    },
  };
  beforeEach(() => jest.clearAllMocks());

  it.each([
    undefined,
    {},
    { userId: '' },
    { userId: 'system', isSystemAccount: true },
  ])('rejects absent or system user %p', (context) => {
    expect(() => requireDemoUser(context)).toThrow(UnauthorizedException);
  });
  it('preserves user IDs as strings without precision loss', () => {
    expect(requireDemoUser({ userId: '9223372036854775806' })).toBe(
      '9223372036854775806',
    );
  });
  it('returns no account to an anonymous session and never queries DB', () => {
    expect(controller.account(request(''))).toBeNull();
    expect(service.account).not.toHaveBeenCalled();
  });
  it('does not accept forged owners or profile fields', () => {
    expect(() =>
      controller.profile(request('user-a'), { ...profile, ownerId: 'user-b' }),
    ).toThrow(BadRequestException);
    expect(service.saveProfile).not.toHaveBeenCalled();
  });
  it('uses verified identity for profile updates, exports and history clear', () => {
    controller.profile(request('user-a'), profile);
    controller.export(request('user-b'));
    controller.clearHistory(request('user-b'));
    expect(service.saveProfile).toHaveBeenCalledWith('user-a', profile);
    expect(service.account).toHaveBeenCalledWith('user-b', 'Reader');
    expect(service.clearHistory).toHaveBeenCalledWith('user-b');
  });
  it('keeps add and remove bound to the caller', () => {
    controller.add(request('user-a'), 'bookmark', 'learning-with-ai');
    controller.remove(request('user-b'), 'bookmark', 'learning-with-ai');
    expect(service.setActivity).toHaveBeenNthCalledWith(
      1,
      'user-a',
      'bookmark',
      'learning-with-ai',
      true,
    );
    expect(service.setActivity).toHaveBeenNthCalledWith(
      2,
      'user-b',
      'bookmark',
      'learning-with-ai',
      false,
    );
  });
  it('rejects unsupported record kinds', () => {
    expect(() =>
      controller.add(request('user-a'), 'admin', 'learning-with-ai'),
    ).toThrow(BadRequestException);
    expect(service.setActivity).not.toHaveBeenCalled();
  });
  it('rejects overlong profile data and non-boolean preferences', () => {
    expect(
      demoProfileInputSchema.safeParse({
        ...profile,
        displayName: 'x'.repeat(61),
      }).success,
    ).toBe(false);
    expect(
      demoProfileInputSchema.safeParse({
        ...profile,
        preferences: { ...profile.preferences, recordHistory: 'false' },
      }).success,
    ).toBe(false);
  });
  it('has unique fixture IDs and actual reading content', () => {
    expect(new Set(DEMO_ARTICLES.map((a) => a.id)).size).toBe(
      DEMO_ARTICLES.length,
    );
    expect(DEMO_ARTICLES.every((a) => a.paragraphs.length >= 6)).toBe(true);
  });
});
