import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FileText,
  History,
  ImagePlus,
  Pencil,
  Search,
  Settings,
  Smile,
  Star,
  UserRound,
  Video,
} from 'lucide-react';
import type {
  DemoAccount,
  DemoActivityKind,
  DemoArticle,
} from '../../../../shared/api.interface';
interface Props {
  feed: DemoArticle[];
  query: string;
  activeTab: string;
  account: DemoAccount | null;
  feature: (s: string) => void;
  setDataTab: (k: DemoActivityKind) => void;
  Actions: ComponentType<{ item: DemoArticle }>;
  Trending: ComponentType;
  Footer: ComponentType;
}
const path = (id: string) => `/question/${id}/answer/demo`;
export function DemoFeed({
  feed,
  query,
  activeTab,
  account,
  feature,
  setDataTab,
  Actions,
  Trending,
  Footer,
}: Props) {
  return (
    <main className="zd-columns">
      <div className="zd-feed-column">
        {!query && activeTab === 'recommend' && (
          <section className="zd-panel zd-composer">
            <button
              className="zd-composer-prompt"
              onClick={() => feature('发想法')}
            >
              <span className="zd-composer-avatar">
                <UserRound size={19} />
              </span>
              分享此刻的想法…
            </button>
            <div className="zd-composer-tools">
              <div>
                <button aria-label="添加话题" onClick={() => feature('发想法')}>
                  #
                </button>
                <button aria-label="添加表情" onClick={() => feature('发想法')}>
                  <Smile size={18} />
                </button>
                <button aria-label="添加图片" onClick={() => feature('发想法')}>
                  <ImagePlus size={18} />
                </button>
                <button aria-label="添加视频" onClick={() => feature('发想法')}>
                  <Video size={19} />
                </button>
                <button aria-label="添加投票" onClick={() => feature('发想法')}>
                  <BarChart3 size={18} />
                </button>
              </div>
              <span>同步到圈子⌃</span>
              <button className="zd-soft" onClick={() => feature('发想法')}>
                发想法
              </button>
            </div>
            <div className="zd-compose-links">
              {[
                { icon: CircleHelp, label: '提问题', color: '#64c9ae' },
                { icon: FileText, label: '写回答', color: '#5287ff' },
                { icon: Pencil, label: '写文章', color: '#eead50' },
                { icon: Video, label: '发视频', color: '#e88bb5' },
              ].map(({ icon: Icon, label, color }) => (
                <button key={label} onClick={() => feature(label)}>
                  <Icon size={18} fill={color} color={color} />
                  <strong>{label}</strong>
                </button>
              ))}
            </div>
          </section>
        )}
        <section className="zd-panel zd-feed" aria-label="问题信息流">
          {(query || activeTab !== 'recommend') && (
            <div className="zd-feed-heading">
              <h1>
                {query
                  ? `“${query}”的搜索结果`
                  : activeTab === 'follow'
                    ? '我关注的问题'
                    : '热榜'}
              </h1>
              <span>{feed.length} 个问题</span>
            </div>
          )}
          {feed.length ? (
            feed.map((item) => (
              <article className="zd-feed-item" key={item.id}>
                <h2>
                  <Link to={path(item.id)}>{item.title}</Link>
                </h2>
                <div className="zd-excerpt">
                  {item.author}： {item.excerpt}{' '}
                  <Link to={path(item.id)}>
                    阅读全文 <ChevronDown size={14} />
                  </Link>
                </div>
                <Actions item={item} />
              </article>
            ))
          ) : (
            <div className="zd-empty">
              <Search size={30} />
              <h2>
                {activeTab === 'follow'
                  ? account
                    ? '还没有关注的问题'
                    : '登录后查看关注的问题'
                  : '没有找到相关内容'}
              </h2>
              <p>
                {query
                  ? '换个词试试，比如「编程」「阅读」或「生活」。'
                  : '在问题详情页点击「关注问题」，就会出现在这里。'}
              </p>
              <Link className="zd-primary" to="/">
                浏览推荐
              </Link>
            </div>
          )}
          <div className="zd-feed-end">
            已看完本次推荐{' '}
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              回到顶部
            </button>
          </div>
        </section>
      </div>
      <aside className="zd-sidebar">
        <section className="zd-panel zd-creator">
          <h3>
            <Pencil size={16} fill="currentColor" />
            创作中心<span>Lv 1</span>
            <button onClick={() => feature('草稿箱')}>草稿箱</button>
          </h3>
          <div className="zd-creator-banner">
            <span>分享经验，也发现新的可能</span>
            <strong>认真回答，分享新知</strong>
            <BookOpen size={58} strokeWidth={1} />
          </div>
          <div className="zd-creator-buttons">
            <button className="zd-outline" onClick={() => feature('创作中心')}>
              进入创作中心 <ChevronRight size={14} />
            </button>
            <Link className="zd-outline" to="/?tab=hot">
              等你来答 <ChevronRight size={14} />
            </Link>
          </div>
        </section>
        <Trending />
        <section className="zd-panel zd-my-links">
          <Link to="/settings/data" onClick={() => setDataTab('bookmark')}>
            <Star size={18} />
            我的收藏{' '}
            <span>
              {account?.activity.filter((a) => a.kind === 'bookmark').length ||
                0}
            </span>
          </Link>
          <Link to="/settings/data" onClick={() => setDataTab('history')}>
            <History size={18} />
            浏览记录{' '}
            <span>
              {account?.activity.filter((a) => a.kind === 'history').length ||
                0}
            </span>
          </Link>
          <Link to="/settings/account">
            <Settings size={18} />
            设置 <ChevronRight size={16} />
          </Link>
        </section>
        <Footer />
      </aside>
    </main>
  );
}
