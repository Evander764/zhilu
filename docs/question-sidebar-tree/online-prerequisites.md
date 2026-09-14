# 第 6 组线上差距与最小修复方案

核验边界固定为 profile `zhihu-hackathon-group6`、应用 `app_17dut1cfq4a`。本轮仅查询环境键、表清单与函数是否存在，不读取变量值或个人行。

2026-09-14/15 读回：online 环境键清单为空；仅有 zhihu_demo_profiles、zhihu_demo_activity；`to_regprocedure('zhilu_reserve_search(integer)') IS NOT NULL` 为 false。旧 `/api/zhilu/status` 503 提示阅读资料无法加载，来自其优先读取缺失 catalog；旧 `/api/zhilu/search` 503 提示搜索未能完成，与额度函数缺失的路径一致。这不是空结果。

当前 search 的错误分支表明可执行路径检查已通过（由源码与返回分支推断）；没有云端进程/版本执行证据，不能声称云端 CLI 真搜索通过。本机官方 CLI 0.5.0 实际返回 10 条，能形成 8 问题、9 回答、1 文章，只证明本机官方搜索与归组可用。

协调任务复验后可采用以下最小修复顺序：

1. 在目标应用 dev 创建单独的 zhilu_budget（id、unique bucket、used 与四个审计字段）；启用并强制 RLS，匿名/登录访问者不能直接查表、改表或重置次数。
2. 参考既有 `scripts/zhilu/search-budget.sql` 安装 `zhilu_reserve_search(integer)`：SECURITY DEFINER、固定 search_path、全局两秒频率限制、上海自然日额度、请求上限最多 200；只授予调用权限。不要让个人数据表承载预算，也不要恢复旧 catalog 或旧内容库来修新接口。
3. 核对平台 dev→online 对表/函数/权限的迁移支持和差异，迁移由协调任务执行；生成 schema 也由协调方按平台规范操作，本执行任务未修改 schema。
4. 目标组织维护者通过正式密钥入口提供有授权来源的 ZHIHU_ACCESS_SECRET；保留默认 CLI transport、最多 10 条，不搬用个人 Keychain 或原组织密钥。无密钥不能放行真实搜索。
5. 同一应用候选构建时执行既有 CLI 打包流程，核对产物路径、可执行性和版本。通过正式发布后调用新 related 端点验证真实搜索及缓存；旧 status 不用作这项验收门。

不可用时继续显示明确错误并保留正文。不得绕过额度、伪造搜索结果、自动创建新应用或改账号逻辑。
