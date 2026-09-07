# 知路问题图谱 · 维护说明

## 入口与结构

默认首页和 `/map` 为问题图谱；`/read` 保留原阅读版；原有 `?p=...` 分享链接继续进入原阅读版。示范入口使用 `/map?journey=start`、`verify`、`choose`。示范和分享参数导入后从地址移除，刷新恢复设备中的后续探索进度。

前端入口：`client/src/pages/QuestionMapPage/QuestionMapPage.tsx`。画布 `QuestionCanvas.tsx` 独立接收公开问题、关系、位置与选择事件，使用 React Flow；阅读、搜索、轨迹和分享分别为独立组件。布局每列向右 320px、碰撞间隔 180px，已有问题位置不随新分支改变。循环与交汇按问题 ID 复用。

旧页面的本地视觉修改不在本次提交中，保留在工作区；旧原型与 OAuth 站未改动。

## 数据与接口

新增应用接口均在 `/api/zhilu/v2`：

- `GET /graph`：精选问题、来源、连接依据与演示路径。
- `GET /questions/:id`：优先读取精选问题，其次读取已索引的公开搜索问题。
- `POST /search`，输入 `{query}`：真实知乎搜索，按问题 ID 合并回答；文章不作为问题返回。
- `POST /questions/:id/expand`，输入 `{query?}`：从已知问题发起检索，排除当前问题，最多返回五个问题和明确标识的检索关联。

数据库沿用 `zhilu_catalog`：`main` 是旧版内容，`questions-v2` 是新精选图谱，`question:<id>` 保存经上游返回和服务端校验的公开搜索记录。API 不开放投稿、编辑或任意索引写入。

真实来源与摘录不进 Git。内容包在仓库外的项目维护目录 `tmp/zhilu-research/questions-v2.json`；原文核查在 `graph-source-audit.json`。更新前执行：

```sh
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/zhilu/validate-question-graph.ts ../tmp/zhilu-research/questions-v2.json
```

检查问题的来源对应、两端摘录、关系依据和三条路径。核查页面不可访问时标记来源 `availability=unavailable`；不能据搜索仍有结果认定原文仍可阅读。网站的片段范围不升级为全文。

DB 变更使用官方 `lark-cli apps +db-execute`，显式选择 `dev` 或 `online`。新实例需要先应用 `scripts/zhilu/question-index.sql`，再写入 `questions-v2` 内容。此函数只能修改 `question:` 前缀，不可修改精选内容或预算。运行时以 `::text` 接收函数返回值，避免平台 SQL 传输层无法解码 PostgreSQL void。

## 搜索、隐私与保存

沿用服务端 `ZHIHU_ACCESS_SECRET` 和受保护配置，不放入浏览器、仓库或日志。上游 12 秒超时、最多十条结果、五分钟缓存；全应用每日最多二百次未缓存请求，两秒短时限流。搜索失败时图谱独立可读。

浏览器 `zhilu-question-map-v2` 保存公开节点、分支、位置、路径和各问题阅读位置。最多六十个问题、一百二十条关系、一百次阅读轨迹。分享只导出公开 ID、连接和顺序，接收端从服务端重建数据；失效 ID 跳过并提示。没有账号同步，不收集跨用户画像。用户可在浏览器站点数据中清除此设备进度。

## 发布与恢复

提交并推送至既有妙搭远端的 `sprint/default`，再创建 release，以 `finished` 和匿名线上回读为准。online 数据不随本地数据自动发布，必须单独检查。

之前可用的运行版本为 `d76980474694d7a8ca7bdcebab75d7c9ee983095`，release `7681874661268933851`。回退本次图谱代码使用 `git revert` 撤销相关提交，再推送并发布；保留数据库的旧 `main` 即可恢复原阅读服务。新问题索引是独立记录，代码回退无需删除数据。

关闭搜索：online 设置 `ZHILU_SEARCH_ENABLED=false` 并重新发布，验证搜索返回明确关闭提示，而 `/api/zhilu/v2/graph` 与旧图谱仍可用。

本地生产构建会覆盖 `dist/client/index.html`。继续开发验收前触发 `client/index.html` 的文件变更，让官方 Vite 插件重新生成开发入口；不能把该构建产物误当作开发服务故障，更不能修改平台的 ViewController 来绕过。

## 真人试用脚本

请试用者选择一个确实关心的问题，自行展开两次，切换一次分支，再返回。观察对方是否能说明当前问题、来路和下一步；让对方区分原作者片段、编辑导引、精选关系与检索关联。最后保存、刷新，并在另一窗口打开分享链接。

分别询问“图上哪里看不清或容易迷路”“这些连接是否值得点开”“相比直接搜索知乎，是否帮助你继续探索”。保留真实回答，允许结论为没有帮助。点击数与测试通过不替代真人认可。本轮未联系试用者或知乎官方。
