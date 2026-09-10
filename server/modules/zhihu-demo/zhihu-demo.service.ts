import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { and, desc, eq } from 'drizzle-orm';
import { zhihuDemoActivity, zhihuDemoProfiles } from '../../database/schema';
import {
  DEMO_ARTICLES,
  demoPreferencesSchema,
  demoActivityKindSchema,
} from '../../../shared/zhihu-demo';
import type {
  DemoAccount,
  DemoActivityKind,
  DemoProfileInput,
} from '../../../shared/api.interface';

@Injectable()
export class ZhihuDemoService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async account(userId: string, name: string): Promise<DemoAccount> {
    const [profiles, activity] = await Promise.all([
      this.db
        .select()
        .from(zhihuDemoProfiles)
        .where(eq(zhihuDemoProfiles.ownerId, userId))
        .limit(1),
      this.db
        .select()
        .from(zhihuDemoActivity)
        .where(eq(zhihuDemoActivity.ownerId, userId))
        .orderBy(desc(zhihuDemoActivity.updatedAt))
        .limit(1000),
    ]);
    const profile = profiles[0];
    return {
      userId,
      displayName: profile?.displayName || name || '知乎体验者',
      bio: profile?.bio || '',
      preferences: demoPreferencesSchema.parse(
        profile ? JSON.parse(profile.preferences) : {},
      ),
      activity: activity.map((row) => ({
        kind: demoActivityKindSchema.parse(row.kind),
        targetId: row.targetId,
        updatedAt: row.updatedAt.toISOString(),
      })),
    };
  }

  async saveProfile(userId: string, input: DemoProfileInput) {
    const fields = {
      displayName: input.displayName,
      bio: input.bio,
      preferences: JSON.stringify(input.preferences),
    };
    await this.db
      .insert(zhihuDemoProfiles)
      .values({ ownerId: userId, ...fields })
      .onConflictDoUpdate({ target: zhihuDemoProfiles.ownerId, set: fields });
    return this.account(userId, input.displayName);
  }

  async setActivity(
    userId: string,
    kind: DemoActivityKind,
    targetId: string,
    enabled: boolean,
  ) {
    if (!DEMO_ARTICLES.some((article) => article.id === targetId))
      throw new NotFoundException('内容不存在');
    if (enabled) {
      if (kind === 'history') {
        const account = await this.account(userId, '');
        if (!account.preferences.recordHistory) return { saved: false };
      }
      await this.db
        .insert(zhihuDemoActivity)
        .values({ ownerId: userId, kind, targetId })
        .onConflictDoUpdate({
          target: [
            zhihuDemoActivity.ownerId,
            zhihuDemoActivity.kind,
            zhihuDemoActivity.targetId,
          ],
          set: { updatedAt: new Date() },
        });
    } else {
      await this.db
        .delete(zhihuDemoActivity)
        .where(
          and(
            eq(zhihuDemoActivity.ownerId, userId),
            eq(zhihuDemoActivity.kind, kind),
            eq(zhihuDemoActivity.targetId, targetId),
          ),
        );
    }
    return { saved: enabled };
  }

  async clearHistory(userId: string) {
    await this.db
      .delete(zhihuDemoActivity)
      .where(
        and(
          eq(zhihuDemoActivity.ownerId, userId),
          eq(zhihuDemoActivity.kind, 'history'),
        ),
      );
    return { cleared: true };
  }
}
