# 先选题，再检索

2026-09-08，已线上发布。网站只使用线上托管入口交付；见 [线上发布与验收](topic-first-release-20260908.md)。

入口顺序：不同方向的选题 → 用户选择 → 服务端调用知乎 CLI → 搜索结果 → 用户选择一条回答 → 阅读与后续探索。

选题只是编辑提出的探索建议，独立保存在 shared/topics.ts；没有来源、回答、关系边或展开动作。不能把示范图谱、保存的轨迹或一个领域下的步骤当作首页选题。首页不请求内容库、不调用搜索；用户明确点击“继续上次阅读”或打开已有分享链接时才恢复图谱。

选题被点击时搜索一次；悬停、键盘聚焦、刷新首页都不搜索。结果返回前显示查找中；失败显示重试，空结果保留空状态；返回选题或切换查询后丢弃旧请求的迟到响应。选中一个真实结果时通过 startFromSearch 建立单节点阅读状态，不自动展开精选相邻节点。

## CLI 运行路径

ZhiluService 默认调用 searchWithCli。用 execFile 和参数数组运行 search zhihu；不通过 shell。12 秒 CLI 等待、15 秒进程上限、2 MiB 输出上限；退出码、业务码及返回结构都要检查。额度函数、五分钟缓存、来源 URL 清洗及结果索引沿用现有实现。相同缓存查询可以不再次启动 CLI。

ZHIHU_CLI_PATH 可指定部署主机上的绝对可执行路径。本机使用官方 Skill 确认的 macOS 安装路径；Linux 默认读取发布包的 bin/zhihu-cli。正式 build 在平台完成原有构建后，按 scripts/zhilu/cli-release.json 固定官方版本及 SHA-256，下载对应 CPU 的 Linux CLI，检查大小、哈希、归档唯一成员、ELF 架构与可执行版本，再打进服务端发布包。凭据由进程环境或 CLI 系统凭据库取得，不传入前端与命令参数。缺少程序时明确失败。只有显式设置 ZHILU_SEARCH_TRANSPORT=http 才使用旧 HTTP 兼容路径，不静默降级。

正式发布已在托管环境执行官方 Linux CLI，匿名搜索及线上调用日志验证通过。未更改线上访问权限。

## 反馈闭环

- classification: project_fact / workflow_gap；decision: modify。
- current_fix: 独立的选题首页和结果页，搜索在点选后触发，结果阅读只从选中的真实问题开始。
- invariant: 未经主动选题/搜索不得检索；选题不带回答或分支，选题不是知乎原问题记录。
- same_scope_checked: 默认首页、/map、鼠标悬停/键盘聚焦、自由搜索、重新选题、历史阅读入口、搜索结果阅读。
- analogous_scope: 搜索失败、零结果、旧请求迟到、恢复阅读。
- prevention_asset: shared/topics.ts、TopicHome 请求序号、shared/graph-state.ts 的 startFromSearch；test/unit/question-graph.spec.ts、test/unit/zhihu-cli.spec.ts。
- verification: 浏览器首次加载零 API 请求、六方向零展开；真实选择返回五个问题；阅读单节点零连线；390px 与 1440px 无横向溢出。单元测试覆盖不能自动展开、命令字面传参、程序缺失、超时、限流和额度耗尽。
- remaining_risk: 选题文案和新首页的用户验收仍待确认；线上浏览器复验因用户接管暂停。

本轮保留绿色和宋体标题的视觉方向，调整入口的信息结构。主要动作从“展开既有内容”改为“选择感兴趣的方向”，细节与来源留在返回结果之后。桌面和手机截图在仓库外 deliverables/zhilu-topic-first/。

部署检查使用官方 `zhihu-cli version` JSON 子命令并严格比较 version 字段；CLI 不支持 `--version`，不得以通用命令习惯替代运行时 help。首次上线构建在此检查安全中止，旧版仍在线；修正后重新发布。
