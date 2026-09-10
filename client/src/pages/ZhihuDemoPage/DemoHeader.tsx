import { useState, useEffect } from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import {
  Bell,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Settings,
  Star,
  UserRound,
} from 'lucide-react';
import { authClient } from '@lark-apaas/client-toolkit/auth';
import { toast } from 'sonner';
import { UserDisplay } from '../../components/business-ui/user-display';
import { Input } from '../../components/ui/input';
import type { DemoAccountState } from './use-demo-account';
import type { DemoActivityKind } from '../../../../shared/api.interface';
interface Props {
  state: DemoAccountState;
  isSettings: boolean;
  id?: string;
  activeTab: string;
  setModal: (s: string) => void;
  setDataTab: (k: DemoActivityKind) => void;
}
export function DemoHeader({
  state,
  isSettings,
  id,
  activeTab,
  setModal,
  setDataTab,
}: Props) {
  const { account, setAccount } = state;
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') || '');
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    setSearch(params.get('q') || '');
  }, [params]);
  useEffect(() => {
    setMenu(false);
  }, [location.pathname]);
  const feature = (name: string) => setModal(`feature:${name}`);
  return (
    <header className="zd-header">
      <div className="zd-header-inner">
        <Link to="/" className="zd-logo" aria-label="知乎界面演示首页">
          知乎
        </Link>
        <nav className="zd-nav" aria-label="主导航">
          {[
            ['follow', '关注'],
            ['recommend', '推荐'],
            ['hot', '热榜'],
          ].map(([value, label]) => (
            <Link
              key={value}
              to={value === 'recommend' ? '/' : `/?tab=${value}`}
              className={
                !isSettings && !id && activeTab === value ? 'active' : ''
              }
            >
              {label}
            </Link>
          ))}
          <button onClick={() => feature('专栏')}>专栏</button>
          <button onClick={() => feature('圈子')}>圈子</button>
          <span className="zd-nav-divider" />
          <button className="zd-ai" onClick={() => feature('AI Works')}>
            AI Works<sup>Beta</sup>
          </button>
          <button onClick={() => feature('故事')}>故事</button>
        </nav>
        <form
          className="zd-search"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(`/?q=${encodeURIComponent(search)}`);
          }}
        >
          <Input
            aria-label="搜索内容"
            placeholder="搜索你感兴趣的内容…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button aria-label="搜索" type="submit">
            <Search size={20} />
          </button>
        </form>
        <button className="zd-zhida" onClick={() => feature('直答')}>
          ◈ 直答
        </button>
        <button
          className="zd-create"
          aria-label="创作"
          onClick={() => feature('创作')}
        >
          <Plus size={23} />
        </button>
        <div className="zd-header-tools">
          <button onClick={() => setModal('messages')}>
            <Bell size={18} fill="currentColor" />
            <small>消息</small>
          </button>
          <button onClick={() => setModal('inbox')}>
            <MessageCircle size={18} fill="currentColor" />
            <small>私信</small>
          </button>
          <button
            className="zd-creator-link"
            onClick={() => feature('创作中心')}
          >
            <Pencil size={18} fill="currentColor" />
            <small>创作中心</small>
          </button>
        </div>
        <div className="zd-user-menu">
          <button
            aria-label="账号菜单"
            className="zd-user-trigger"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {account ? (
              <span className="zd-current-avatar">
                <UserDisplay
                  value={[account.userId]}
                  showLabel={false}
                  size="small"
                />
              </span>
            ) : (
              <UserRound size={22} />
            )}
          </button>
          {menu && (
            <>
              <button
                className="zd-menu-dismiss"
                aria-label="关闭账号菜单"
                onClick={() => setMenu(false)}
              />
              <div className="zd-menu">
                <strong>{account?.displayName || '尚未登录'}</strong>
                <Link to="/settings/account">
                  <UserRound size={16} /> 我的主页
                </Link>
                <Link
                  to="/settings/data"
                  onClick={() => setDataTab('bookmark')}
                >
                  <Star size={16} /> 我的收藏
                </Link>
                <Link to="/settings/account">
                  <Settings size={16} /> 设置
                </Link>
                {account ? (
                  <button
                    onClick={async () => {
                      const result = await authClient.session.signOut();
                      if (result.error) {
                        toast.error('退出失败，请重试');
                        return;
                      }
                      setAccount(null);
                      setMenu(false);
                      window.location.reload();
                    }}
                  >
                    退出登录
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setMenu(false);
                      setModal('login');
                    }}
                  >
                    登录 / 注册
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
