# 知路 · 体验版 0.1

本地待发布修改：[先选题再检索](docs/topic-first-entry.md)。首页展示多个方向，点选后调用 CLI 搜索；部署前需核实托管主机的 CLI。

最新发布：2026-09-08 [桌面交互版与线上验收](docs/desktop-release-20260908.md)。紧凑问题地图、悬停预览、原文阅读与本机讨论草稿已发布；多人讨论尚未接入。

从一个回答，找到下一步。围绕 AI 时代的技能学习，提供可回查的知乎来源、编辑导读、阅读路径与实时搜索。无需登录，设备保存进度，分享链接仅含公开节点顺序。

Miaoda application: `app_17dg665m8tq`。发布分支：`sprint/default`。

## 本地维护

- 本项目使用妙搭官方 NestJS / React 脚手架与 SDK。旧原型及 OAuth 站在上一级目录，互不替换。
- `npm ci` 安装依赖；`npm run dev:local` 按官方流程拉取开发配置并启动。开发入口为本机 `8187/app/app_17dg665m8tq/`，后端端口 `3187`。端口在被忽略的 `.env.local` 设置。
- `npm run lint` 包含样式、代码与前后端类型检查；`npm test -- --runInBand test/unit/zhilu.spec.ts` 验证路径和搜索边界；`npm run build:prod` 构建。构建会改写官方模板的 `dist/client/index.html`，不要和开发预览同时验收；构建后重新运行完整 `dev:local` 再检查本地界面。
- 服务端入口：`server/modules/zhilu/`；阅读界面：`client/src/pages/ZhiluPage/`；接口契约：`shared/api.interface.ts`。

## 内容与数据

精选资料存于应用数据库 `zhilu_catalog` 的 `main` 记录；不是客户端内置假数据。12 条短摘录、6 个问题、13 条编辑连接、3 条演示路径。原文回到知乎阅读。

资料只核对了官方搜索接口返回的内容片段，未声称取得全文。所有连接标为编辑整理关系；来源两端的摘录、理由和适用范围都可查看。来源索引在页脚。当前以编程为主要场景，不代表所有成人技能学习者的共同效果。

第三方原始材料、短摘录包、候选检索记录和截图放在仓库外的项目 `tmp/zhilu-research` 与 `deliverables/zhilu-qa`，不得提交进 Git。应用 DB 是已发布内容的维护位置。此应用首次发布只同步了表结构，未同步开发数据；维护时必须显式指定 `--environment online` 写入并回查正式资料，不能依赖省略环境参数的自动选择。更新前将现有 `main` 记录导出到受保护本地目录，核对后再导入新版本。

校验内容包：

```sh
npx ts-node --project tsconfig.node.json scripts/zhilu/validate-catalog.ts /absolute/private/catalog.json
```

校验器检查最低数量、来源域名、节点支持、连接两端证据、每处最多三个下一步、演示路径相邻关系。逐字摘录及事实范围仍需对照原始材料复核。失效来源将 `availability` 改为 `unavailable`，同时调整受影响节点与演示路线，仍须满足发布最低数量。

## 搜索与隐私

- `GET /api/zhilu/graph`：精选资料与连接。
- `GET /api/zhilu/nodes/:id`：单节点、来源和下一步。
- `POST /api/zhilu/search`：`{query, nodeId?}`，返回最多十条标题、作者、搜索片段、原文链接。搜索发现不写入精选资料。
- `GET /api/zhilu/status`：当前资料版本与搜索启用状态，不返回凭证。

官方 SDK 为接口提供 CSRF 保护。匿名 HTTP 验证需任意同值的 `suda-csrf-token` cookie 与 `X-Suda-Csrf-Token` header；它不是登录凭证。前端必须使用 SDK `axiosForBackend`。

`ZHIHU_ACCESS_SECRET` 只存在开发/线上服务端环境配置，使用已有 Keychain 凭证经标准输入写入；不从聊天接收，不写浏览器、Git 或日志。不要用 `--include-values` 输出环境配置。异常日志仅记录受控错误码，绝不记录 Axios 错误对象。

同查询在单实例内缓存五分钟，最多 100 项；没有跨实例缓存共享，因此多实例下重复查询可能再次消耗次数。数据库统一控制全应用两秒一个未缓存请求、上海时区每天最多 200 次，所有实例共享。失败请求也计次，以限制上游压力。只记录日期和计数，不记录用户查询、身份或跨用户画像。平台可能保留必要运行日志。

`ZHILU_DAILY_SEARCH_LIMIT` 可向下调节，不能高于 200。`ZHILU_SEARCH_ENABLED=false` 可关闭实时搜索，精选路径继续可读。缓存可能在服务重启时清空。

SDK 默认以访客角色访问数据库。`scripts/zhilu/search-budget.sql` 提供唯一受限额度函数：只允许消耗名额，不能读写或重置额度表。请勿通过放开额度表写权限“修复”搜索失败。

## 发布与恢复

1. 完成内容校验、测试、构建、浏览器验收；检查暂存区无凭证及第三方材料。
2. 提交并推送 `sprint/default`；`lark-cli apps +release-create --app-id app_17dg665m8tq --branch sprint/default --as user`。
3. 用返回的 release ID 查询 `+release-get`，必须为 `finished`；随后验证真实页面和接口。
4. 运行时范围已按本项目目标设置为 public / require-login=false。更改后需用 `+access-scope-get` 回查并重新验证无登录访问。
5. 紧急降级：将 online 环境 `ZHILU_SEARCH_ENABLED` 设置为 `false`，创建新发布使运行实例加载配置；检查 `/api/zhilu/status` 为关闭，精选图谱仍可读。
6. 代码恢复：在 `sprint/default` 使用 `git revert` 恢复到最后验证通过的发布对应代码，提交、推送并重新发布。不要强推，不要删除内容库。首次发布前没有上一可用产品版本；首个完成线上验证的版本是后续恢复基线。
7. 内容恢复：从维护者发布前的受保护导出还原 `main`，再检查 `status` 和三条路线。图谱有一分钟服务缓存。

测试范围和真人试用脚本见 [docs/acceptance.md](docs/acceptance.md)。部署记录见 [docs/release.md](docs/release.md)。
