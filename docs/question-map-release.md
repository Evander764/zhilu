# 知路问题图谱 · 2026-09-07 发布

[公开网站](https://icnimtns216g.feishuapp.com/app/app_17dg665m8tq/map)，免登录。

三条试走路径：

- [开始自学](https://icnimtns216g.feishuapp.com/app/app_17dg665m8tq/map?journey=start)：自学编程 → 零基础建议 → 调试 → 学习吃力。
- [借助 AI](https://icnimtns216g.feishuapp.com/app/app_17dg665m8tq/map?journey=verify)：AI 辅助编程 → 自学建议 → 调试 → 学习吃力。
- [考虑付费](https://icnimtns216g.feishuapp.com/app/app_17dg665m8tq/map?journey=choose)：课程是否值得 → 自学编程 → 零基础建议。

链接从各路径起点开始，沿节点展开和阅读继续；它们不是自动播放教程。首页同时支持自由搜索知乎问题。

## 发布证据

- 妙搭应用：`app_17dg665m8tq`。
- Release：`7682728221788670930`，`finished`，2026-09-07。
- 运行提交：`70ac88cf5d16cb7eece73656b427532da1540015`；主体实现提交 `d51871c`。
- 内容：`questions-v2`，版本 `2.0.0`；8 个问题、12 条来源、11 条精选连接。
- 公开范围：All，require_login=false；已独立清空登录 Cookie 验证网站与搜索。
- 发布后的文档提交仅记录验收，不改变运行版本。

[验收记录](question-map-acceptance.md) 区分本地、线上和未验证项；[维护说明](question-map-maintenance.md) 包含接口、内容更新和真人试用脚本。

## 恢复

上一可用版本：代码 `d76980474694d7a8ca7bdcebab75d7c9ee983095`，release `7681874661268933851`。在干净分支按时间倒序撤销 `70ac88c`、`d51871c`，推送并发布恢复版本；先确认没有夹带工作区的旧页面视觉修改。保留旧数据库 `main`，无需删除新的问题索引。

仅关闭搜索时，设置服务端 `ZHILU_SEARCH_ENABLED=false` 后重新发布；分别验证搜索关闭提示、精选图谱和旧阅读版仍可使用。

## 当前评价边界

技术验收和匿名发布已完成；审美仍是候选，真人使用价值尚未验证。首组选题集中于自学与编程。未联系试用者或知乎官方，也未提交赛事。
