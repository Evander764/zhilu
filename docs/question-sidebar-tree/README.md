# 相关问题侧栏候选

状态：本地实现候选，待协调独立复验、同一应用部署及线上操作验收。不能把原线上地址当作本轮功能的交付。

读者打开六篇示例中的问题后，页面按标题调用官方知乎搜索。右侧显示当前问题、按真实问题编号归组的相关问题及回答；点击问题会切换应用内路由并检索新标题，回答提供作者、搜索片段与知乎原文链接。文章进入补充阅读，不编造问题归属。外部问题只展示搜索片段，不套用六篇示例正文或示例作者。

## 接线与来源

- `shared/related-tree.ts` 定义请求、响应校验及确定性归组。只接受 HTTPS 知乎公开 question/answer、zhuanlan/p 路径；拒绝用户信息、端口、重定向路径、控制字符及异常编号。最多处理 10 条。官方 ContentID 是检索记录标识，不保证等于 URL 实体编号；保存在 upstreamContentId，关系只用 URL 中的 questionId/answerId/articleId。
- `POST /api/zhilu/related` 位于既有 ZhiluModule；调用原 ZhiluService.search 时只传 query，不传 demo ID，不读旧 catalog。原搜索仍使用固定官方地址／无 shell 的 CLI 参数数组、5 分钟缓存和全局额度函数。本轮补同查询在途去重、失败清理，以及鉴权/限流分类。
- `ZhihuDemoPage` 的实际问题路由直接接入 hook。相关问题链接携带真实编号和标题，刷新可恢复检索；浏览器后退恢复问题及已记录的滚动位置。没有新增账号接口或外部问题的个人数据写入。
- 前端通过 axiosForBackend 访问，并校验完整响应。临时内存缓存有效期 5 分钟，最多 100 项；无 localStorage、数据库或日志保存搜索文本。快速切换和关闭会使旧订阅失效；失败只由显式重试恢复。关闭 A 后切 B 会恢复 B 的自动搜索，关闭同一问题不持续请求。

## 版式约束

使用 aesthetic-layout 审计模式，沿用既有知乎演示方向。主任务是读正文，支任务是继续探索；P0 为标题/正文，P1 为问题跳转和来源，P2 为作者及搜索说明。原 `zhihu-demo.css` 和原答案 `<article>` 逐字节不动，694/296px 网格和既有 1050/760px 断点沿用。

清晰基线是原作者侧栏；策略候选是在原侧栏加入有层级线的问题与回答，作者信息折叠后仍可达；过载反例是把正文改成全屏力导图或同时预抓多层关系，本轮不采用。蓝色用于当前节点/可点击入口，灰线只表达检索分组和问题拥有回答的关系，不声称语义推理或作者引用。无新字体、图片、生成模型或依赖。

桌面展开/收起不切换网格、不触碰页面滚动。手机抽屉采用现有 Radix Dialog 的焦点约束与 Esc 关闭，按钮位于回顶按钮上方；相关问题的自动检索与抽屉是否遮住正文分开，初始不自动弹出抽屉。真实像素、键盘、焦点及最终审美仍需线上读回。

## 验证入口

所有命令在项目目录加 `rtk proxy`。外部证据目录是 `../deliverables/question-sidebar-tree-20260914`，不提交原始响应、日志或截图。

```text
npm test -- --runInBand
npm run lint
npm run build:prod
git diff --check
node scripts/zhihu-demo/verify-related-scope.mjs ../deliverables/question-sidebar-tree-20260914/baseline.json
node scripts/zhihu-demo/check-related-sensitivity.mjs
node scripts/zhihu-demo/verify-related-render.mjs
node scripts/zhihu-demo/verify-related.mjs --upstream-file ../deliverables/question-sidebar-tree-20260914/related-real-upstream.json
```

敏感性检查的两项必须满足：实际校验拒绝时 exit 1；故意移除实际校验时 exit 0，使反向检查能发现失效。不得在拒绝分支末尾无条件 throw，不能用一个永远报错的脚本证明门禁有效。

内存组件渲染验证只证明当前 React 组件包含正确路由、来源和状态；请求生命周期测试在数据源边界模拟响应，服务测试使用实际 Controller/Service 与模拟外部 HTTP/数据库，不是线上搜索证据。线上必须在候选部署后另跑下面两项，并按 `online-acceptance.md` 操作浏览器。

```text
node scripts/zhihu-demo/verify-related.mjs --online https://ucne7375gmu5.feishuapp.com/app/app_17dut1cfq4a
node scripts/zhihu-demo/verify-online.mjs https://ucne7375gmu5.feishuapp.com/app/app_17dut1cfq4a
```

## 回撤

功能代码在独立分支上，未合并发布分支。必要时只回撤本轮提交。额度结构/目标配置由协调任务单独管理，代码回撤不删除预算记录或个人数据。
