import { DemoHeader } from './DemoHeader';
import { DemoFeed } from './DemoFeed';
import { DemoDialog } from './DemoDialog';
import { useEffect, useState } from 'react';
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Flame,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Share2,
  Star,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';

import { resolveAppUrl } from '@lark-apaas/client-toolkit/utils/resolveAppUrl';

import { setDemoActivity } from '../../api';
import { DEMO_ARTICLES } from '../../../../shared/zhihu-demo';
import type {
  DemoActivityKind,
  DemoArticle,
} from '../../../../shared/api.interface';
import { useDemoAccount } from './use-demo-account';
import { DemoSettings } from './DemoSettings';
import { RelatedSidebar } from './RelatedSidebar';
import { RelatedReading } from './RelatedReading';
import { useRelatedTree, useRelatedVisibility } from './use-related-tree';
import { useRelatedScroll } from './use-related-scroll';
import { relatedRouteRequest } from '../../../../shared/related-tree';
import './zhihu-demo.css';
import './related-tree.css';

const count = (n: number) =>
  n >= 10000 ? `${(n / 10000).toFixed(1)} 万` : n.toLocaleString('zh-CN');
const path = (id: string) => `/question/${id}/answer/demo`;
function AuthorAvatar({
  item,
  large = false,
}: {
  item: DemoArticle;
  large?: boolean;
}) {
  return (
    <span
      className={`zd-author-avatar ${large ? 'large' : ''}`}
      style={{ background: item.color }}
      aria-hidden="true"
    >
      {item.author.slice(0, 1)}
    </span>
  );
}

export default function ZhihuDemoPage() {
  const location = useLocation();
  const { id, section = 'account' } = useParams();
  const [params] = useSearchParams();
  const [modal, setModal] = useState('');
  const state = useDemoAccount(() => setModal('login'));
  const { account, error, busy, refresh, has, mutate, toggle } = state;
  const [dataTab, setDataTab] = useState<DemoActivityKind>('bookmark');
  const [showAll, setShowAll] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const isSettings = location.pathname.startsWith('/settings');
  const article = id ? DEMO_ARTICLES.find((item) => item.id === id) : undefined;
  const current = article
    ? { query: article.title }
    : relatedRouteRequest(id, params.get('title'));
  const { open: relatedOpen, setOpen: setRelatedOpen } = useRelatedVisibility(
    JSON.stringify(current),
  );
  const related = useRelatedTree(current, relatedOpen);
  useRelatedScroll();
  const sidebar = current ? (
    <RelatedSidebar
      current={current}
      state={related}
      retry={related.retry}
      open={relatedOpen}
      setOpen={setRelatedOpen}
    />
  ) : null;
  const activeTab = params.get('tab') || 'recommend';
  const query = (params.get('q') || '').trim().toLowerCase();
  useEffect(() => {
    document.title = `${isSettings ? '设置' : article?.title || current?.query || '首页'} - 知乎界面演示`;
    setShowAll(false);
  }, [location.pathname, article?.title, current?.query, isSettings]);
  useEffect(() => {
    setHistoryError('');
    if (!article || !account?.userId || !account.preferences.recordHistory)
      return;
    let active = true;
    void setDemoActivity('history', article.id, true)
      .then(() => {
        if (active) void refresh();
      })
      .catch(() => {
        if (active) setHistoryError('此次浏览记录未保存，点击重试');
      });
    return () => {
      active = false;
    };
  }, [
    article?.id,
    account?.userId,
    account?.preferences.recordHistory,
    refresh,
  ]);
  const feature = (name: string) => setModal(`feature:${name}`);
  async function share(item: DemoArticle) {
    try {
      await navigator.clipboard.writeText(resolveAppUrl(path(item.id)));
      toast.success('链接已复制');
    } catch {
      setModal('share');
    }
  }
  function Actions({ item }: { item: DemoArticle }) {
    return (
      <div className="zd-actions">
        <button
          className={`zd-vote ${has('vote', item.id) ? 'selected' : ''}`}
          onClick={() => toggle('vote', item.id)}
          disabled={busy}
          aria-pressed={has('vote', item.id)}
        >
          <span>▲</span> {has('vote', item.id) ? '已赞同' : '赞同'}{' '}
          {count(item.votes + (has('vote', item.id) ? 1 : 0))}
        </button>
        <button
          className="zd-down"
          aria-label="赞同选项"
          onClick={() => setModal('votes')}
        >
          <ChevronDown size={15} fill="currentColor" />
        </button>
        <button onClick={() => feature('评论')}>
          <MessageCircle size={15} fill="currentColor" /> {item.comments} 条评论
        </button>
        <button
          onClick={() => toggle('bookmark', item.id)}
          disabled={busy}
          className={has('bookmark', item.id) ? 'is-blue' : ''}
          aria-label={has('bookmark', item.id) ? '取消收藏' : '收藏'}
          aria-pressed={has('bookmark', item.id)}
        >
          <Star size={16} fill="currentColor" />{' '}
          {has('bookmark', item.id) ? '已收藏' : '收藏'}
        </button>
        <button className="zd-thanks" onClick={() => feature('喜欢')}>
          <Heart size={15} fill="currentColor" /> 喜欢
        </button>
        <button onClick={() => void share(item)}>
          <Share2 size={16} fill="currentColor" /> 分享
        </button>
        <button
          className="zd-more"
          aria-label="更多操作"
          onClick={() => setModal('about')}
        >
          <MoreHorizontal size={17} />
        </button>
      </div>
    );
  }
  function Trending() {
    return (
      <section className="zd-panel zd-trending">
        <h3>
          <Flame size={17} fill="#ff6d56" color="#ff6d56" /> 大家都在搜{' '}
          <span>演示话题</span>
        </h3>
        {DEMO_ARTICLES.map((item, index) => (
          <Link key={item.id} to={path(item.id)}>
            <i style={{ color: index < 3 ? '#ff7658' : '#9199a8' }}>•</i>
            <span>{item.title}</span>
            <small>{count(item.views)}</small>
            {index < 3 && <em>热</em>}
          </Link>
        ))}
        <Link to="/?tab=hot" className="zd-trending-all">
          查看全部话题 <ChevronRight size={14} />
        </Link>
      </section>
    );
  }
  function Footer() {
    return (
      <footer className="zd-footer">
        <p>知乎界面演示 · 黑客松项目</p>
        <p>示例内容与计数用于功能演示</p>
        <p>非知乎官方网站 · 使用独立应用账号</p>
        <button onClick={() => setModal('about')}>关于此演示</button>
        <span> · </span>
        <Link to="/settings/data">个人数据管理</Link>
      </footer>
    );
  }
  const filtered = DEMO_ARTICLES.filter(
    (item) =>
      (!query ||
        `${item.title}${item.excerpt}${item.tags.join('')}`
          .toLowerCase()
          .includes(query)) &&
      (activeTab !== 'follow' || has('follow', item.id)),
  );
  const feed =
    activeTab === 'hot'
      ? [...filtered].sort((a, b) => b.views - a.views)
      : filtered;

  return (
    <div
      className={`zd-app ${account?.preferences.compactFeed ? 'zd-compact' : ''}`}
    >
      <DemoHeader
        state={state}
        isSettings={isSettings}
        id={id}
        activeTab={activeTab}
        setModal={setModal}
        setDataTab={setDataTab}
      />
      {error && (
        <div className="zd-error" role="alert">
          {error}
          <button onClick={() => void refresh()}>重新加载</button>
        </div>
      )}
      {isSettings ? (
        <DemoSettings
          state={state}
          section={section}
          openModal={setModal}
          initialTab={dataTab}
        />
      ) : id ? (
        article ? (
          <>
            <section className="zd-question-header">
              <div className="zd-question-inner">
                <div className="zd-question-main">
                  <div className="zd-tags">
                    {article.tags.map((tag) => (
                      <Link key={tag} to={`/?q=${encodeURIComponent(tag)}`}>
                        {tag}
                      </Link>
                    ))}
                  </div>
                  <h1>{article.title}</h1>
                  <div className="zd-question-byline">
                    <AuthorAvatar item={article} />
                    {article.author}
                    <span>提出了这个问题</span>
                  </div>
                  <p>
                    {article.excerpt}
                    {showAll &&
                      ' 这个问题没有唯一答案。欢迎从自己的经历出发，思考哪些经验可以帮助下一位读者。'}{' '}
                    <button onClick={() => setShowAll(!showAll)}>
                      {showAll ? '收起' : '显示全部'}
                      <ChevronDown size={14} />
                    </button>
                  </p>
                  <div className="zd-question-buttons">
                    <button
                      className={
                        has('follow', article.id) ? 'zd-outline' : 'zd-primary'
                      }
                      disabled={busy}
                      onClick={() => toggle('follow', article.id)}
                    >
                      {has('follow', article.id) ? '已关注问题' : '关注问题'}
                    </button>
                    <button
                      className="zd-outline"
                      onClick={() => feature('写回答')}
                    >
                      <Pencil size={15} />
                      写回答
                    </button>
                    <button
                      className="zd-invite"
                      onClick={() => feature('邀请回答')}
                    >
                      <UserRound size={16} />
                      邀请回答
                    </button>
                    <button onClick={() => void share(article)}>
                      <Share2 size={16} />
                      分享
                    </button>
                    <small>演示内容</small>
                  </div>
                </div>
                <div className="zd-question-stats">
                  <div>
                    <span>关注者</span>
                    <strong>
                      {count(
                        article.followers + (has('follow', article.id) ? 1 : 0),
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>被浏览</span>
                    <strong>{count(article.views)}</strong>
                  </div>
                </div>
              </div>
            </section>
            <main className="zd-columns zd-detail zd-related-detail">
              <div>
                <div className="zd-all-answers zd-panel">
                  正在阅读 1 个示例回答{' '}
                  <Link to="/">
                    返回推荐 <ChevronRight size={14} />
                  </Link>
                </div>
                <article className="zd-answer zd-panel">
                  <div className="zd-answer-author">
                    <AuthorAvatar item={article} large />
                    <div>
                      <strong>{article.author}</strong>
                      <p>{article.bio}</p>
                    </div>
                    <button
                      className="zd-soft"
                      disabled={busy}
                      onClick={() => toggle('follow', article.id)}
                    >
                      {has('follow', article.id) ? '已关注' : '+ 关注问题'}
                    </button>
                  </div>
                  <p className="zd-voters">
                    {count(article.votes)} 人赞同了该回答{' '}
                    <ChevronRight size={13} />
                  </p>
                  <div className="zd-prose">
                    {article.paragraphs.map((paragraph, index) =>
                      paragraph.startsWith('## ') ? (
                        <h2 key={index}>{paragraph.slice(3)}</h2>
                      ) : (
                        <p key={index}>{paragraph}</p>
                      ),
                    )}
                  </div>
                  <p className="zd-published">
                    发布于 2026-09-09 · 原创演示内容
                  </p>
                  {historyError && (
                    <button
                      className="zd-history-error"
                      onClick={() =>
                        void mutate(async () => {
                          await setDemoActivity('history', article.id, true);
                          setHistoryError('');
                        }, '浏览记录已保存')
                      }
                    >
                      {historyError}
                    </button>
                  )}
                  <div className="zd-answer-actions">
                    <Actions item={article} />
                  </div>
                </article>
                <div className="zd-panel zd-next">
                  <h3>继续阅读</h3>
                  {DEMO_ARTICLES.filter((item) => item.id !== article.id)
                    .slice(0, 3)
                    .map((item) => (
                      <Link key={item.id} to={path(item.id)}>
                        {item.title}
                        <ChevronRight size={17} />
                      </Link>
                    ))}
                </div>
              </div>
              <aside className="zd-sidebar zd-related-sidebar">
                {sidebar}
                <details className="zd-panel zd-author-access">
                  <summary>关于作者</summary>
                  <section className="zd-panel zd-about-author">
                    <h3>关于作者</h3>
                    <div className="zd-about-person">
                      <AuthorAvatar item={article} large />
                      <div>
                        <strong>{article.author}</strong>
                        <p>{article.bio}</p>
                      </div>
                    </div>
                    <div className="zd-author-stats">
                      <span>
                        回答<b>1</b>
                      </span>
                      <span>
                        文章<b>0</b>
                      </span>
                      <span>
                        关注者<b>{article.followers}</b>
                      </span>
                    </div>
                    <button
                      className="zd-primary"
                      disabled={busy}
                      onClick={() => toggle('follow', article.id)}
                    >
                      <Plus size={18} />
                      {has('follow', article.id)
                        ? '已关注这个问题'
                        : '关注这个问题'}
                    </button>
                  </section>
                </details>
                <Trending />
                <Footer />
              </aside>
            </main>
          </>
        ) : current ? (
          <RelatedReading
            current={current}
            title={params.get('title') || current.query}
            question={related.knownQuestion}
            state={related}
            sidebar={sidebar}
          />
        ) : (
          <main className="zd-panel zd-empty zd-not-found">
            <h1>这个内容不存在</h1>
            <p>链接可能已失效，回推荐页看看其他问题。</p>
            <Link className="zd-primary" to="/">
              返回推荐
            </Link>
          </main>
        )
      ) : (
        <DemoFeed
          feed={feed}
          query={query}
          activeTab={activeTab}
          account={account}
          feature={feature}
          setDataTab={setDataTab}
          Actions={Actions}
          Trending={Trending}
          Footer={Footer}
        />
      )}
      <button
        className="zd-back-top"
        aria-label="回到顶部"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <ArrowUp size={22} />
      </button>
      <DemoDialog
        state={state}
        modal={modal}
        setModal={setModal}
        article={article}
      />
    </div>
  );
}
