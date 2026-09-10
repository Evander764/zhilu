# 发布记录 · 2026-09-05

公开入口：[知路](https://icnimtns216g.feishuapp.com/app/app_17dg665m8tq)

- 应用：`app_17dg665m8tq`
- 发布编号：`7681874661268933851`
- 运行代码提交：`d76980474694d7a8ca7bdcebab75d7c9ee983095`
- 发布分支：`sprint/default`
- 平台状态：`finished`，完成时间 2026-09-05 10:40:59（上海时区）
- 内容版本：`0.1.0`；12 条来源、6 个问题、13 条连接。
- 访问范围回读：`scope=All`，`require_login=false`。

## 线上验证

无登录凭证的请求实际得到：首页 200、状态 200、图谱 200、知乎搜索 200 / 10 条结果。匿名请求仅带任意同值 CSRF cookie/header，不带账号 cookie 或 Authorization。相同查询再次命中缓存。

浏览器打开分享路径后恢复节点顺序、原文入口和下一步；搜索真实工作。手机窄屏验收及详细回读证据保存在仓库外 `deliverables/zhilu-qa`。发布图谱与已核准内容包逐字段相同。

首次发布时表结构已存在，但 online 环境没有 main 资料行，导致图谱 503。已把核准的 0.1.0 内容明确导入 online 环境并重新验证，当前为 200。维护操作必须显式指定环境，不能把开发环境通过视为线上完成。运行代码未因这次数据导入改变。

本文件和验收说明是部署后补齐的文档；后续文档提交不改变上述运行代码版本。第一份可用产品发布即为以上代码与内容基线；此前不存在上一可用产品版本。

## 恢复基线

- 代码：保留 `d76980474694d7a8ca7bdcebab75d7c9ee983095`，后续出现回归时通过 `git revert` 撤销引入回归的提交，推送并新建发布。以新 release 的 finished 和匿名实际请求为验收标准。
- 内容：仓库外受保护的 `tmp/zhilu-research/catalog-v0.1.0-baseline.json`；通过维护者官方 DB 管理命令恢复 online 的 main 记录，一分钟内图谱缓存到期后复查。
- 搜索关闭：online 环境设置 `ZHILU_SEARCH_ENABLED=false`，新建发布使运行实例加载配置，验证 status 中搜索关闭、图谱仍为 200。实时搜索失败时页面会给出重试提示，已有精选阅读不依赖搜索或运行时大模型。

## 分享路线

- [看懂以后，怎样做出来](https://icnimtns216g.feishuapp.com/app/app_17dg665m8tq?p=practice)：开始练习 → 发现问题 → 获得反馈。
- [AI 做完以后，怎样检查自己](https://icnimtns216g.feishuapp.com/app/app_17dg665m8tq?p=ai)：AI 辅助 → 发现问题 → 获得反馈 → 回到练习。
- [报课之前，先弄清需要什么](https://icnimtns216g.feishuapp.com/app/app_17dg665m8tq?p=paid)：判断付费 → 明确目标 → 开始练习。

真人使用效果、审美认可、实体手机与慢速网络体验尚未验证；未联系测试者、发群消息或提交赛事。
