import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Compass,
  Map,
  Search,
  Share2,
  X,
} from 'lucide-react';
import { Input } from '../../components/ui/input';
import { getGraph, searchZhihu } from '../../api';
import type {
  Graph,
  SearchResult,
  Source,
} from '../../../../shared/api.interface';
import { parsePath } from '../../../../shared/path';
import './zhilu.css';
import { RoadmapHome } from './RoadmapHome';

const STORAGE_KEY = 'zhilu:path:v1';

function errorMessage(error: unknown): string {
  const response = error as {
    response?: { data?: { error?: { message?: string }; message?: string } };
  };
  return (
    response.response?.data?.error?.message ||
    response.response?.data?.message ||
    '暂时无法连接，请稍后重试。'
  );
}

function SourceReading({ source }: { source: Source }) {
  return (
    <article className="source-reading">
      <div className="source-byline">
        <span className="author-initial" aria-hidden="true">
          {source.author.slice(0, 1)}
        </span>
        <span>
          {source.author}
          <small>知乎发布内容</small>
        </span>
        <a
          className="source-link"
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          查看原文 <ArrowUpRight size={15} />
        </a>
      </div>
      <h3>{source.label}</h3>
      <p className="guide-label">编辑导读</p>
      <p className="source-guide">{source.guide}</p>
      <blockquote>
        <p>{source.excerpt}</p>
        <cite>原话摘录 · 来自搜索片段</cite>
      </blockquote>
      <p className="source-scope">
        <span>适用边界</span>
        {source.scope}
      </p>
      <details className="source-detail">
        <summary>来源与核对范围</summary>
        <p>{source.title}</p>
        <p>
          获取于 {new Date(source.fetchedAt).toLocaleDateString('zh-CN')} ·{' '}
          {source.coverage}，未取得完整文章。
        </p>
        <p>
          {source.availability === 'unavailable'
            ? '来源暂不可访问，请改读其他材料。'
            : '搜索接口返回可检索；原网页的登录要求和访问状态可能变化。'}
        </p>
        <p>
          本站保留短摘录和整理关系；作者身份与观点不代表本站背书，也不保证原内容未使用
          AI。
        </p>
      </details>
    </article>
  );
}

export default function ZhiluPage() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [loadError, setLoadError] = useState('');
  const [savedPath, setSavedPath] = useState<string[]>([]);
  const [storageReady, setStorageReady] = useState(true);
  const [notice, setNotice] = useState('');
  const [overlay, setOverlay] = useState<
    'map' | 'search' | 'about' | 'sources' | null
  >(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const positions = useRef<Record<string, number>>({});
  const searchSequence = useRef(0);
  const location = useLocation();
  const navigate = useNavigate();
  const pathValue = new URLSearchParams(location.search).get('p');
  const parsedPath = graph ? parsePath(pathValue, graph) : [];
  const invalidPath = parsedPath === null;
  const path = parsedPath || [];
  const current = graph?.nodes.find(
    (node) => node.id === path[path.length - 1],
  );
  const nodeSources = current
    ? graph!.sources.filter((source) => current.sourceIds.includes(source.id))
    : [];
  const nextEdges = current
    ? graph!.edges.filter((edge) => edge.fromId === current.id).slice(0, 3)
    : [];

  const load = () => {
    setLoadError('');
    getGraph()
      .then(setGraph)
      .catch((error: unknown) => setLoadError(errorMessage(error)));
  };
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!graph) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setSavedPath(parsePath(stored, graph) || []);
    } catch {
      setStorageReady(false);
      setNotice('浏览器未允许保存；当前阅读与分享仍可使用。');
    }
  }, [graph]);
  useEffect(() => {
    if (!graph || invalidPath) return;
    if (path.length) {
      try {
        localStorage.setItem(STORAGE_KEY, path.join('.'));
        setSavedPath(path);
      } catch {
        setStorageReady(false);
        setNotice('进度未能保存到设备；可复制路径链接保留。');
      }
    }
    const key = pathValue || '';
    const frame = requestAnimationFrame(() => {
      window.scrollTo(0, positions.current[key] || 0);
      mainRef.current?.focus({ preventScroll: true });
    });
    const remember = () => {
      positions.current[key] = window.scrollY;
    };
    window.addEventListener('scroll', remember, { passive: true });
    setShareUrl('');
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', remember);
    };
  }, [pathValue, graph, invalidPath]);
  useEffect(() => {
    if (overlay) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [overlay]);
  useEffect(() => {
    document.title = current
      ? `${current.stage} · 知路`
      : '知路 · 从一个回答，找到下一步';
  }, [current]);

  function go(ids: string[]) {
    setOverlay(null);
    setNotice('');
    navigate({
      pathname: '/',
      search: ids.length ? `?p=${ids.join('.')}` : '',
    });
  }
  function next(id: string) {
    if (path.length >= 24) {
      setNotice('这条路径已走过 24 步。可先分享保存，再从问题地图开启新路径。');
      return;
    }
    go([...path, id]);
  }
  function openSearch() {
    setOverlay('search');
    setQuery('');
    setResults(null);
    setSearchError('');
    searchSequence.current++;
    setSearching(false);
  }
  async function runSearch() {
    if (query.trim().length < 2) {
      setSearchError('请至少输入两个字符，描述你现在的卡点。');
      return;
    }
    const sequence = ++searchSequence.current;
    setSearching(true);
    setSearchError('');
    setResults(null);
    try {
      const value = await searchZhihu({
        query: query.trim(),
        nodeId: current?.id,
      });
      if (sequence === searchSequence.current) setResults(value);
    } catch (error) {
      if (sequence === searchSequence.current)
        setSearchError(errorMessage(error));
    } finally {
      if (sequence === searchSequence.current) setSearching(false);
    }
  }
  async function share() {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    if (path.length) url.searchParams.set('p', path.join('.'));
    setShareUrl(url.toString());
    try {
      await navigator.clipboard.writeText(url.toString());
      setNotice('路径链接已复制，只包含公开问题及顺序。');
    } catch {
      setNotice('请选择并复制路径链接。');
      requestAnimationFrame(() =>
        document.getElementById('share-link')?.focus(),
      );
    }
  }
  function keepDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return;
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), summary, [tabindex="0"]',
      ),
    ).filter((element) => element.getClientRects().length > 0);
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  function clearSaved() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setSavedPath([]);
      setNotice('本设备保存的路径已清除。');
    } catch {
      setNotice('未能清除，请检查浏览器的存储设置。');
    }
  }

  return (
    <div className={`zhilu-app ${current ? 'is-reading' : 'is-home'}`}>
      <a href="#main" className="skip-link">
        跳到主要内容
      </a>
      <header className="site-header">
        <button
          className="brand"
          onClick={() => go([])}
          aria-label="知路，回到起点"
        >
          <svg
            className="brand-symbol"
            viewBox="0 0 36 36"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M8 26V15a7 7 0 017-7h13M8 26h13a7 7 0 007-7V8"
              stroke="currentColor"
              strokeWidth="2.5"
            />
            <circle cx="8" cy="26" r="4" fill="currentColor" />
            <circle cx="28" cy="8" r="4" fill="currentColor" />
          </svg>
          <strong>知路</strong>
          <span className="brand-tagline">每个问题，都有下一步。</span>
        </button>
        <nav aria-label="主导航">
          <button onClick={() => setOverlay('map')}>
            <Map size={17} />
            问题地图
          </button>
          <button aria-label="找内容" onClick={openSearch}>
            <Search size={17} />
            <span>找内容</span>
          </button>
        </nav>
      </header>
      <main id="main" tabIndex={-1} ref={mainRef}>
        {loadError ? (
          <div className="empty-state">
            <h1>资料暂时没能加载</h1>
            <p>{loadError}</p>
            <button className="primary-action" onClick={load}>
              重新加载
            </button>
          </div>
        ) : !graph ? (
          <div className="empty-state" role="status">
            <Compass className="loading-compass" />
            <p>正在打开阅读路径…</p>
          </div>
        ) : current ? (
          <>
            <div className="reading-toolbar">
              <button onClick={() => go(path.slice(0, -1))}>
                <ArrowLeft size={16} />
                {path.length > 1 ? '返回上一问题' : '回到起点'}
              </button>
              <span>AI 时代的技能学习</span>
              <button onClick={share}>
                <Share2 size={16} />
                分享路径
              </button>
            </div>
            <details className="mobile-path">
              <summary>已走过 {path.length} 个问题 · 查看路径</summary>
              {path.map((id, i) => (
                <button
                  key={`${i}-${id}`}
                  onClick={() => go(path.slice(0, i + 1))}
                >
                  {i + 1}. {graph.nodes.find((node) => node.id === id)?.stage}
                </button>
              ))}
            </details>
            <div className="reader-grid">
              <aside className="journey-sidebar">
                <p className="eyebrow">这一次的来路</p>
                <ol>
                  {path.map((id, i) => (
                    <li
                      key={`${id}-${i}`}
                      className={i === path.length - 1 ? 'current-stop' : ''}
                    >
                      <button onClick={() => go(path.slice(0, i + 1))}>
                        <span>{String(i + 1).padStart(2, '0')}</span>
                        {graph.nodes.find((node) => node.id === id)?.stage}
                      </button>
                    </li>
                  ))}
                </ol>
                <p className="saved-note">
                  <Check size={14} />
                  {storageReady
                    ? '进度保存在本设备'
                    : '进度未保存，可分享链接保留'}
                </p>
                <button
                  className="text-action"
                  onClick={() => setOverlay('map')}
                >
                  展开问题地图 <ArrowUpRight size={14} />
                </button>
              </aside>
              <section
                className="reading-column"
                aria-labelledby="reading-title"
              >
                <p className="eyebrow">{current.stage}</p>
                <h1 id="reading-title">{current.title}</h1>
                <p className="reading-deck">{current.subtitle}</p>
                <div className="reading-source-count">
                  <BookOpen size={15} />
                  {nodeSources.length} 条知乎内容 · 导读与原话分开展示
                </div>
                {nodeSources.map((source) => (
                  <SourceReading key={source.id} source={source} />
                ))}
                <div className="reading-pause">
                  <span className="pause-mark" aria-hidden="true" />
                  <div>
                    <h3>读到这里，也可以先去试一次。</h3>
                    <p>不必把所有分支看完。带着一个具体问题回来就好。</p>
                  </div>
                </div>
              </section>
              <aside className="next-column" aria-labelledby="next-title">
                <p className="eyebrow">接住你的下一问</p>
                <h2 id="next-title">你现在卡在哪？</h2>
                {nextEdges.map((edge) => (
                  <div className="next-option" key={edge.id}>
                    <span className="relation-label">{edge.kind}</span>
                    <button
                      data-next={edge.toId}
                      onClick={() => next(edge.toId)}
                    >
                      {edge.label}
                      <ArrowRight size={18} />
                    </button>
                    <p>{edge.reason}</p>
                    <details>
                      <summary>连接依据</summary>
                      <p>{edge.basis}，不代表原作者互相引用或认可。</p>
                      {edge.sourceIds.map((id) => {
                        const source = graph.sources.find(
                          (entry) => entry.id === id,
                        );
                        return (
                          source && (
                            <div key={id}>
                              <p>“{source.excerpt}”</p>
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {source.author}：{source.label} ↗
                              </a>
                            </div>
                          )
                        );
                      })}
                    </details>
                  </div>
                ))}
                <button className="search-more" onClick={openSearch}>
                  <Search size={17} />
                  没有合适方向？再找找
                </button>
              </aside>
            </div>
          </>
        ) : (
          <>
            {invalidPath && (
              <div className="route-warning" role="alert">
                这条分享路径不完整或已失效。可以从下面重新选择；原有资料仍可阅读。
              </div>
            )}
            <RoadmapHome
              graph={graph}
              savedPath={savedPath}
              onRead={go}
              onMap={() => setOverlay('map')}
              onSearch={openSearch}
            />
          </>
        )}
        {notice && (
          <div className="notice" role="status">
            {notice}
            <button aria-label="关闭提示" onClick={() => setNotice('')}>
              <X size={14} />
            </button>
          </div>
        )}
        {shareUrl && (
          <div className="share-box">
            <label htmlFor="share-link">路径链接</label>
            <Input
              id="share-link"
              readOnly
              value={shareUrl}
              onFocus={(event) => event.target.select()}
            />
          </div>
        )}
      </main>
      <footer className="site-footer">
        <span>
          知路 <span className="footer-divider">/</span>{' '}
          让阅读有来路，也有去处。
        </span>
        <button onClick={() => setOverlay('sources')}>来源索引</button>
        <button onClick={() => setOverlay('about')}>内容说明与隐私</button>
        <span>体验版 0.1</span>
      </footer>
      <dialog
        ref={dialogRef}
        onKeyDown={keepDialogFocus}
        aria-label={
          overlay === 'map'
            ? '问题地图'
            : overlay === 'search'
              ? '搜索发现'
              : overlay === 'sources'
                ? '来源索引'
                : '内容说明与隐私'
        }
        className="zhilu-dialog"
        onCancel={() => setOverlay(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOverlay(null);
        }}
      >
        <div className="dialog-heading">
          <span className="eyebrow">
            {overlay === 'map'
              ? '问题地图'
              : overlay === 'search'
                ? '搜索发现'
                : overlay === 'sources'
                  ? '来源索引'
                  : '关于知路'}
          </span>
          <button aria-label="关闭窗口" onClick={() => setOverlay(null)}>
            <X size={22} />
          </button>
        </div>
        {overlay === 'map' && graph && (
          <>
            <h2>选择你现在想弄清的事</h2>
            <p className="dialog-description">
              从这里选择会开启一条新路径。已有来路仍可用浏览器返回。
            </p>
            <div className="map-list">
              {graph.nodes.map((node) => (
                <button key={node.id} onClick={() => go([node.id])}>
                  <span>{node.stage}</span>
                  <strong>{node.title}</strong>
                  <ArrowUpRight size={18} />
                </button>
              ))}
            </div>
          </>
        )}
        {overlay === 'search' && (
          <>
            <h2>
              {current ? `关于${current.stage}，再找找` : '你现在想解决什么？'}
            </h2>
            <p className="dialog-description">
              搜索知乎已发布内容。结果尚未经本站逐条核准，不会自动加入精选路径。
            </p>
            <div role="search" className="search-form">
              <label className="sr-only" htmlFor="search-query">
                描述你的卡点
              </label>
              <Input
                id="search-query"
                autoFocus
                maxLength={120}
                value={query}
                placeholder="例如：学完 Python，怎么开始第一个项目"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' &&
                    !event.nativeEvent.isComposing &&
                    !searching
                  )
                    void runSearch();
                }}
              />
              <button
                className="primary-action"
                disabled={searching}
                onClick={runSearch}
              >
                {searching ? '查找中…' : '搜索'}
              </button>
            </div>
            <p className="search-privacy">
              搜索文字仅用于这次查询，不进入分享链接或个人画像。
            </p>
            {searchError && (
              <p className="search-error" role="alert">
                {searchError}
              </p>
            )}
            {searching && (
              <p role="status" className="search-status">
                正在查询知乎内容，请稍候…
              </p>
            )}
            {results && (
              <div aria-live="polite">
                <p className="results-count">
                  {results.items.length
                    ? `找到 ${results.items.length} 条内容`
                    : '暂时没有找到相关内容，可换一个更具体的说法。'}
                  {results.cached ? ' · 五分钟内的查询缓存' : ''}
                </p>
                {results.items.map((item) => (
                  <article className="search-result" key={item.url}>
                    <span>{item.author} · 搜索片段</span>
                    <h3>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {item.title}
                        <ArrowUpRight size={16} />
                      </a>
                    </h3>
                    <p>{item.excerpt}</p>
                    <small>未经本站核准 · 具体内容请阅读原文</small>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
        {overlay === 'sources' && graph && (
          <>
            <h2>{graph.sources.length} 条来源，都能回查</h2>
            <p className="dialog-description">
              当前均为官方搜索接口返回的片段。本站核对摘录与导读，不将片段当作全文。
            </p>
            {graph.sources.map((source) => (
              <article className="search-result" key={source.id}>
                <span>
                  {source.author} ·{' '}
                  {new Date(source.fetchedAt).toLocaleDateString('zh-CN')} ·{' '}
                  {source.coverage}
                </span>
                <h3>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {source.title}
                    <ArrowUpRight size={16} />
                  </a>
                </h3>
                <p>{source.scope}</p>
                {source.availability === 'unavailable' && <p>来源暂不可访问</p>}
              </article>
            ))}
          </>
        )}
        {overlay === 'about' && (
          <div className="about-copy">
            <h2>把回答连接起来，让人继续往前走。</h2>
            <p>
              内容来自知乎用户发布的回答和文章。我们使用短摘录，保留作者与原文入口；导读和跨内容连接由
              AI 辅助整理并在发布前核对，界面不会现场生成答案。
            </p>
            <p>
              精选表示相关片段与连接经过整理核对，不等于作者身份、事实或学习效果得到独立证实。当前内容以编程学习为主要例子，其他技能需自行判断适用范围。
            </p>
            <p>
              本设备保存公开节点及顺序。分享链接不包含搜索文字和身份；不提供跨设备账号同步。搜索文字发送至本站服务及知乎搜索接口，短期缓存用于减少重复请求。本站不建立个人画像，托管平台可能保留必要的运行日志。
            </p>
            <p>
              如果原文失效或连接不符合你的处境，可直接返回并选择另一条路径。当前版本不承诺学习效果，也不推荐购买特定课程。
            </p>
            <button className="outline-action" onClick={clearSaved}>
              清除本设备保存的路径
            </button>
          </div>
        )}
      </dialog>
    </div>
  );
}
