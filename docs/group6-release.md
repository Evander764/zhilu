# 第 6 组重新发布记录

2026-09-10。目标组织：树成林知乎黑客松6组（玖淳、纸鸢、万象榕、鱼尾山屋）。

- CLI profile：`zhihu-hackathon-group6`，使用 `--as user`；当前本人身份已验证为马新淳。
- 目标妙搭应用：`app_17dut1cfq4a`；[管理入口](https://miaoda.feishu.cn/app/app_17dut1cfq4a)。
- 源码来源：原项目提交 `554c48a5ef99e0ae01e0fe443103465c4b8743a3`。284 个 client/server/shared/test/scripts/package 文件逐个与原提交比较，内容完全相同。仅应用标识和部署说明适配第 6 组。
- 原应用属于其他组织，新账号访问原应用返回 40300；本轮在目标组织重新承载同一版本。
- 原应用的用户记录、环境变量、密钥和历史内容库没有跨组织复制。本版推荐的六篇原创演示内容来自既有源码，账号数据从空库开始。
- `zhihu_demo_profiles`、`zhihu_demo_activity` 两张业务表已创建并从 dev 迁移到 online；RLS 开启且强制，owner_id 归属策略已读回。两名临时测试用户的数据隔离验证通过，测试记录清理完成。
- 平台迁移为 online 的匿名角色保留表级 SELECT 权限；没有匿名行策略，强制 RLS 拒绝匿名读取业务行。
- 67 项测试、lint、前后端生产构建通过。
- 旧 `/map`、`/read` 路由的内容库和旧搜索服务配置不属于本轮三页演示迁移；需要恢复时另行接入有来源的公开内容和目标组织自己的配置。

## 再次发布

所有资源命令显式指定 `--profile zhihu-hackathon-group6`。CLI 1.0.74 的初始化子进程和 Git 凭证助手还依赖当前 profile，Git 操作前先核对 `lark-cli whoami`，必要时切到该 profile，避免用其他组织身份重试。

提交并推送 `sprint/default` 后，用 `apps +release-create --app-id app_17dut1cfq4a --branch sprint/default --as user` 发起发布，并用同一 release_id 读回 `finished`；随后运行 `scripts/zhihu-demo/verify-online.mjs` 检查新地址。

发布状态：待本轮发布回读。
