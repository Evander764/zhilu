import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  ChevronRight,
  Download,
  History,
  LockKeyhole,
  Settings,
  Shield,
  UserRound,
  X,
} from 'lucide-react';
import { authClient } from '@lark-apaas/client-toolkit/auth';
import { UserDisplay } from '../../components/business-ui/user-display';
import { Input } from '../../components/ui/input';
import { Switch } from '../../components/ui/switch';
import { saveDemoProfile, exportDemoAccount, setDemoActivity } from '../../api';
import {
  DEMO_ARTICLES,
  demoPreferencesSchema,
} from '../../../../shared/zhihu-demo';
import type {
  DemoActivityKind,
  DemoProfileInput,
  DemoPreferences,
} from '../../../../shared/api.interface';
import type { DemoAccountState } from './use-demo-account';

const settingItems = [
  { id: 'account', label: '账号与密码', icon: UserRound },
  { id: 'notification', label: '消息与邮件', icon: Bell },
  { id: 'filter', label: '屏蔽', icon: Shield },
  { id: 'privacy', label: '隐私', icon: LockKeyhole },
  { id: 'preference', label: '偏好设置', icon: Settings },
  { id: 'data', label: '我的数据', icon: History },
];
interface SettingsProps {
  state: DemoAccountState;
  section: string;
  openModal: (name: string) => void;
  initialTab: DemoActivityKind;
}
export function DemoSettings({
  state,
  section,
  openModal,
  initialTab,
}: SettingsProps) {
  const { account, loading, error, busy, mutate, refresh } = state;
  const [draft, setDraft] = useState<DemoProfileInput>({
    displayName: '',
    bio: '',
    preferences: demoPreferencesSchema.parse({}),
  });
  const [dataTab, setDataTab] = useState<DemoActivityKind>(initialTab);
  useEffect(() => {
    setDataTab(initialTab);
  }, [initialTab]);
  useEffect(() => {
    if (account)
      setDraft({
        displayName: account.displayName,
        bio: account.bio,
        preferences: account.preferences,
      });
  }, [account]);
  function preference(key: keyof DemoPreferences, value: boolean) {
    if (!account) return;
    void mutate(
      () =>
        saveDemoProfile({
          displayName: account.displayName,
          bio: account.bio,
          preferences: { ...account.preferences, [key]: value },
        }),
      '设置已保存',
    );
  }
  return (
    <main className="zd-settings-layout">
      <div className="zd-settings-main zd-panel">
        <nav className="zd-settings-nav" aria-label="设置分类">
          {settingItems.map(({ id, label, icon: Icon }) => (
            <Link
              key={id}
              to={`/settings/${id}`}
              className={section === id ? 'active' : ''}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>
        <section className="zd-settings-content">
          <div className="zd-settings-title">
            <h1>
              {settingItems.find((item) => item.id === section)?.label ||
                '设置'}
            </h1>
            <p>
              {section === 'data'
                ? '收藏 / 浏览记录 / 数据导出'
                : section === 'account'
                  ? '账号设置 / 个人资料'
                  : '管理你的个人偏好'}
            </p>
          </div>
          {loading ? (
            <div className="zd-empty">正在加载账号…</div>
          ) : !account ? (
            <div className="zd-empty">
              <UserRound size={32} />
              <h2>{error ? '暂时无法读取账号' : '登录后，管理属于你的内容'}</h2>
              <p>收藏、浏览记录和设置会保存在你的账号中。</p>
              <button
                className="zd-primary"
                onClick={() => (error ? void refresh() : openModal('login'))}
              >
                {error ? '重试' : '登录 / 注册'}
              </button>
            </div>
          ) : (
            <>
              {section === 'account' && (
                <>
                  <div className="zd-settings-intro">
                    <h2>账号设置</h2>
                    <p>使用应用登录账号，安全验证由登录平台完成。</p>
                  </div>
                  <div className="zd-setting-row">
                    <div>
                      <h3>当前账号</h3>
                      <UserDisplay value={[account.userId]} size="small" />
                    </div>
                    <button
                      onClick={() =>
                        authClient.session.navigateToUserProfile({
                          newTab: true,
                        })
                      }
                    >
                      管理账号
                    </button>
                  </div>
                  <div className="zd-setting-row">
                    <div>
                      <h3>密码与登录方式</h3>
                      <p>由飞书 / 妙搭账号统一管理</p>
                    </div>
                    <button
                      onClick={() =>
                        authClient.session.navigateToUserProfile({
                          newTab: true,
                        })
                      }
                    >
                      管理
                    </button>
                  </div>
                  <form
                    className="zd-profile-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void mutate(
                        () => saveDemoProfile(draft),
                        '个人资料已保存',
                      );
                    }}
                  >
                    <h2>个人资料</h2>
                    <label htmlFor="demo-name">昵称</label>
                    <Input
                      id="demo-name"
                      required
                      maxLength={60}
                      value={draft.displayName}
                      onChange={(e) =>
                        setDraft({ ...draft, displayName: e.target.value })
                      }
                    />
                    <label htmlFor="demo-bio">一句话介绍</label>
                    <Input
                      id="demo-bio"
                      maxLength={160}
                      placeholder="介绍一下自己，让大家更了解你"
                      value={draft.bio}
                      onChange={(e) =>
                        setDraft({ ...draft, bio: e.target.value })
                      }
                    />
                    <p className="zd-muted">
                      资料仅用于本演示应用，不会修改你的知乎账号。
                    </p>
                    <button
                      className="zd-primary"
                      disabled={busy}
                      type="submit"
                    >
                      {busy ? '保存中…' : '保存修改'}
                    </button>
                  </form>
                </>
              )}
              {section === 'privacy' && (
                <>
                  <div className="zd-setting-row">
                    <div>
                      <h3>记录浏览历史</h3>
                      <p>关闭后不再保存新的浏览记录</p>
                    </div>
                    <Switch
                      aria-label="记录浏览历史"
                      checked={account.preferences.recordHistory}
                      disabled={busy}
                      onCheckedChange={(value) =>
                        preference('recordHistory', value)
                      }
                    />
                  </div>
                  <div className="zd-setting-row">
                    <div>
                      <h3>清空浏览记录</h3>
                      <p>只清空当前账号的浏览记录，收藏会保留</p>
                    </div>
                    <button
                      className="zd-danger-text"
                      onClick={() => openModal('clear-history')}
                    >
                      清空
                    </button>
                  </div>
                  <div className="zd-settings-intro">
                    <h2>你的数据只对你可见</h2>
                    <p>收藏、浏览记录、个人资料和偏好设置按账号独立保存。</p>
                  </div>
                </>
              )}
              {section === 'preference' && (
                <div className="zd-setting-row">
                  <div>
                    <h3>紧凑浏览</h3>
                    <p>缩短推荐页摘要，每屏浏览更多问题</p>
                  </div>
                  <Switch
                    aria-label="紧凑浏览"
                    checked={account.preferences.compactFeed}
                    disabled={busy}
                    onCheckedChange={(value) =>
                      preference('compactFeed', value)
                    }
                  />
                </div>
              )}
              {section === 'notification' && (
                <>
                  <div className="zd-setting-row">
                    <div>
                      <h3>邮件通知偏好</h3>
                      <p>保存是否接收邮件的偏好</p>
                    </div>
                    <Switch
                      aria-label="邮件通知偏好"
                      checked={account.preferences.emailNotifications}
                      disabled={busy}
                      onCheckedChange={(value) =>
                        preference('emailNotifications', value)
                      }
                    />
                  </div>
                  <p className="zd-settings-note">
                    此演示暂不发送邮件或站内通知。
                  </p>
                </>
              )}
              {section === 'filter' && (
                <div className="zd-empty">
                  <Shield size={30} />
                  <h2>还没有屏蔽的用户</h2>
                  <p>此演示暂不支持用户屏蔽。</p>
                </div>
              )}
              {section === 'data' && (
                <>
                  <div className="zd-data-summary">
                    {(
                      [
                        ['bookmark', '我的收藏'],
                        ['history', '浏览记录'],
                        ['follow', '关注的问题'],
                      ] as const
                    ).map(([kind, label]) => (
                      <div key={kind}>
                        <strong>
                          {
                            account.activity.filter((a) => a.kind === kind)
                              .length
                          }
                        </strong>
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="zd-data-tabs">
                    {(
                      [
                        ['bookmark', '收藏'],
                        ['history', '浏览记录'],
                        ['follow', '关注'],
                        ['vote', '赞同'],
                      ] as const
                    ).map(([kind, label]) => (
                      <button
                        key={kind}
                        className={dataTab === kind ? 'active' : ''}
                        onClick={() => setDataTab(kind)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="zd-data-list">
                    {!account.activity.some((a) => a.kind === dataTab) ? (
                      <div className="zd-empty">
                        <BookOpen size={30} />
                        <h3>这里还没有内容</h3>
                        <p>去推荐页读一读，把喜欢的内容留下来。</p>
                        <Link className="zd-primary" to="/">
                          浏览推荐
                        </Link>
                      </div>
                    ) : (
                      account.activity
                        .filter((a) => a.kind === dataTab)
                        .map((record) => (
                          <div className="zd-data-item" key={record.targetId}>
                            <div>
                              <Link
                                to={`/question/${record.targetId}/answer/demo`}
                              >
                                {DEMO_ARTICLES.find(
                                  (item) => item.id === record.targetId,
                                )?.title || '内容已不可用'}
                              </Link>
                              <p>
                                {new Date(record.updatedAt).toLocaleString(
                                  'zh-CN',
                                )}
                              </p>
                            </div>
                            <button
                              disabled={busy}
                              aria-label="移除记录"
                              onClick={() =>
                                void mutate(
                                  () =>
                                    setDemoActivity(
                                      dataTab,
                                      record.targetId,
                                      false,
                                    ),
                                  '记录已移除',
                                )
                              }
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))
                    )}
                  </div>
                  <div className="zd-data-bottom">
                    <button
                      className="zd-outline"
                      disabled={busy}
                      onClick={() =>
                        void mutate(async () => {
                          const data = await exportDemoAccount();
                          const url = URL.createObjectURL(
                            new Blob([JSON.stringify(data, null, 2)], {
                              type: 'application/json',
                            }),
                          );
                          const anchor = document.createElement('a');
                          anchor.href = url;
                          anchor.download = '我的知乎演示数据.json';
                          anchor.click();
                          setTimeout(() => URL.revokeObjectURL(url), 1000);
                        }, '已导出当前账号的数据')
                      }
                    >
                      <Download size={16} /> 导出我的数据
                    </button>
                    <button
                      className="zd-danger-text"
                      onClick={() => openModal('clear-history')}
                    >
                      清空浏览记录
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>
      <aside className="zd-settings-help zd-panel">
        <h2>常见问题</h2>
        <h3>账号与数据</h3>
        <p>1. 这里和我的知乎账号互通吗？</p>
        <span>这是独立的演示应用，不会读取或修改知乎账号。</span>
        <p>2. 换设备后数据还在吗？</p>
        <span>使用同一应用账号登录后，可以继续查看已保存的内容。</span>
        <p>3. 别人能看到我的收藏吗？</p>
        <span>每个账号独立保存，个人数据仅本人可见。</span>
        <p>4. 如何导出我的数据？</p>
        <Link to="/settings/data">
          前往「我的数据」
          <ChevronRight size={14} />
        </Link>
        <footer className="zd-footer">
          <p>知乎界面演示 · 黑客松项目</p>
          <p>非知乎官方网站</p>
        </footer>
      </aside>
    </main>
  );
}
