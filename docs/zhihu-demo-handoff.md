# 知乎界面演示底座

当前任务：按 2026-09-09 现场观察的知乎界面实现推荐、回答详情、设置三页，并提供真实账号和个人数据管理。首页切换为此底座，后续产品功能由其他开发者接入。

## 页面与接入位置

| 路径 | 用途 | 入口文件 |
| --- | --- | --- |
| `/` | 推荐，搜索，关注与示例热榜 | `client/src/pages/ZhihuDemoPage/DemoFeed.tsx` |
| `/question/:id/answer/demo` | 问题题头、全文回答、作者侧栏 | `client/src/pages/ZhihuDemoPage/ZhihuDemoPage.tsx` |
| `/settings/account` | 登录账号与可编辑个人资料 | `client/src/pages/ZhihuDemoPage/DemoSettings.tsx` |
| `/settings/data` | 收藏、浏览、关注、赞同记录与导出 | 同上 |
| `/settings/privacy` | 浏览历史开关和清空 | 同上 |
| `/settings/preference` | 紧凑信息流偏好 | 同上 |
| `/map`、`/read` | 保留此前知路页面 | 原有模块 |

导航、信息流、弹窗、设置与账号状态已拆分，CSS 使用 `zd-` 前缀，不影响旧知路页面。约 694px 主栏、296px 侧栏、62px 顶栏；移动端转为单栏。

## 内容与范围

`shared/zhihu-demo.ts` 是演示内容唯一来源：六篇原创示例回答、虚构作者和示例计数。它们不代表真实知乎内容或实时热榜。前端默认直接消费该稳定数据；服务端 `GET /api/zhihu-demo/articles` 提供相同内容合同。

推荐、全文阅读、搜索（本演示内容范围）、关注列表、示例热榜排序、收藏、赞同、关注问题、历史、个人资料、偏好、数据移除、导出和清空历史已接通。发内容、评论、私信、用户屏蔽、AI Works、直答等入口保留视觉位置，并明确提示尚未开放。邮件设置只存偏好，当前不发邮件。

若接入真实内容，应替换内容适配层，并同时更新服务端 `setActivity` 的内容存在性校验；不能只换前端列表。只有标题和摘要的来源不得伪装为全文。新增功能可通过 `feature(name)` 对应的入口替换弹窗实现。

## 登录与个人数据合同

使用官方 `authClient.session` 登录/退出；属于飞书/妙搭应用账号，与知乎账号独立。不收集知乎密码。

| 接口 | 行为 |
| --- | --- |
| `GET /api/zhihu-demo/me` | 当前账号与记录；返回 `{account}`，访客为 `{account: null}`，禁止缓存 |
| `PUT /api/zhihu-demo/me/profile` | 保存昵称、简介、三个布尔偏好；严格校验未知字段 |
| `PUT /api/zhihu-demo/me/activity/:kind/:targetId` | 幂等添加收藏、浏览、赞同或关注 |
| `DELETE /api/zhihu-demo/me/activity/:kind/:targetId` | 移除当前用户对应记录 |
| `DELETE /api/zhihu-demo/me/history` | 仅清空当前用户浏览历史 |
| `GET /api/zhihu-demo/me/export` | 导出当前用户 JSON，不含其他用户记录 |

用户标识必须来自 `req.userContext.userId`，保持字符串；写与导出均要求真实登录，系统账号不能代替用户。接口不接收 `ownerId`。数据表 `zhihu_demo_profiles` 和 `zhihu_demo_activity` 的 RLS 使用 SDK 注入的 `app.user_id`，对应用专属 `authenticated_<schema>` 角色执行 `USING` 和 `WITH CHECK`。不要改成全局 `authenticated`，平台专属角色不继承它；已通过现场查询验证。

公共文章与示例计数共享；用户操作独立保存，不修改示例基础计数。浏览记录开关关闭后不再记新记录。无需本地存储个人数据。清空前有确认框，移除记录按本人及类别过滤。

## 维护和验证

- `npm run lint`、`npm test -- --runInBand`、`npm run build:prod`。
- Jest 按运行时开启 TypeScript legacy decorators，确保 Controller 测试真正执行。
- `scripts/zhihu-demo/schema.sql` 为两张业务表及隔离策略的幂等迁移。先在 dev 执行，再预览 `apps +db-env-diff`，确认无其他语义变化后 `+db-env-migrate`；线上禁止直接 DDL，不能通过换通道绕过。
- `scripts/zhihu-demo/verify-isolation.sql` 在 dev 用同一原子语句建立临时 A/B 身份，验证本人的读写、跨用户读/改/删拒绝、伪造所有者写入拒绝、匿名拒绝，最后清理。任何断言失败会回滚整条语句，避免遗留数据。
- 发布后须读回 online 表的 RLS、策略和角色权限，并在真实线上浏览器测试登录、收藏、刷新、资料保存、历史关闭、导出及移动断点。
- 此版 67 项测试通过；视觉为待用户审阅候选，不把技术检查写成 1:1 人工验收通过。

## 恢复

恢复旧首页可以回退本轮代码或将首页路由指向 `QuestionMapPage`，再正常提交与发布；保留新增业务表，以免删除用户收藏。不要强推、清空内容库或混入 `.agents/skills/coding-guide/SKILL.md` 的已有本地修改。
