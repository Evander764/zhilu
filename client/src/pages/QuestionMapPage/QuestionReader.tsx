import { Link } from 'react-router-dom';
import { useEffect, useRef, useState, type RefObject } from 'react';
import QuestionDiscussion from './QuestionDiscussion';
import {
  X,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GitBranch,
  Search,
  ArrowRight,
  MessageCircle,
  BookOpen,
} from 'lucide-react';
import {
  addBranch,
  collapseBranch,
  selectQuestion,
  type Exploration,
} from '../../../../shared/graph-state';
import type {
  PublicQuestion,
  QuestionGraph,
  QuestionLink,
} from '../../../../shared/question-graph';
interface ReaderProps {
  state: Exploration;
  graph: QuestionGraph;
  question: PublicQuestion;
  current: string;
  readerOpen: boolean;
  setReaderOpen: (open: boolean) => void;
  reader: RefObject<HTMLDivElement>;
  scrolls: RefObject<Record<string, number>>;
  incoming: QuestionLink[];
  outgoing: QuestionLink[];
  setState: (state: Exploration) => void;
  setNotice: (text: string) => void;
  curatedExpand: () => void;
  openSearch: (id: string | null) => void;
}
export default function QuestionReader({
  state,
  graph,
  question,
  current,
  readerOpen,
  setReaderOpen,
  reader,
  scrolls,
  incoming,
  outgoing,
  setState,
  setNotice,
  curatedExpand,
  openSearch,
}: ReaderProps) {
  const [tab, setTab] = useState<'read' | 'discussion'>('read');
  const [quote, setQuote] = useState<{ id: string } | null>(null);
  const readPosition = useRef(0);
  useEffect(() => {
    setTab('read');
    setQuote(null);
    readPosition.current = scrolls.current[current] || 0;
  }, [current]);
  function changeTab(next: 'read' | 'discussion') {
    if (reader.current && tab === 'read')
      readPosition.current = reader.current.scrollTop;
    setTab(next);
    requestAnimationFrame(() => {
      if (reader.current)
        reader.current.scrollTop = next === 'read' ? readPosition.current : 0;
    });
  }
  return (
    <aside
      className={`qm-reader ${readerOpen ? 'is-open' : ''}`}
      id="qm-reader"
      data-reader-tab={tab}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setReaderOpen(false);
          e.stopPropagation();
        }
      }}
      tabIndex={-1}
      aria-label="问题与回答阅读"
    >
      <button
        className="qm-desktop-reader-close"
        aria-label="收起阅读面板"
        onClick={() => setReaderOpen(false)}
      >
        <X size={17} />
      </button>
      <button
        className="qm-mobile-reader-toggle"
        onClick={() => setReaderOpen(!readerOpen)}
        aria-expanded={readerOpen}
      >
        <span>{readerOpen ? '收起阅读' : question.title}</span>
        <ChevronDown size={18} />
      </button>
      <div
        className="qm-reader-scroll"
        ref={reader}
        onScroll={(e) => {
          if (tab === 'read')
            scrolls.current[current] = e.currentTarget.scrollTop;
        }}
      >
        <div className="qm-reader-top">
          <span className="qm-eyebrow">
            {question.origin === 'curated' ? '精选问题' : '搜索发现'}
          </span>
          <a href={question.url} target="_blank" rel="noopener noreferrer">
            原问题
            <ExternalLink size={12} />
          </a>
        </div>
        <h2>{question.title}</h2>
        <div
          className="qm-reader-tabs"
          role="tablist"
          aria-label="阅读与讨论"
          onKeyDown={(e) => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
              e.preventDefault();
              const next =
                e.key === 'Home'
                  ? 'read'
                  : e.key === 'End'
                    ? 'discussion'
                    : tab === 'read'
                      ? 'discussion'
                      : 'read';
              changeTab(next);
              requestAnimationFrame(() =>
                document
                  .getElementById(
                    next === 'read' ? 'qm-read-tab' : 'qm-discuss-tab',
                  )
                  ?.focus(),
              );
            }
          }}
        >
          <button
            id="qm-read-tab"
            role="tab"
            aria-selected={tab === 'read'}
            aria-controls="qm-read-panel"
            onClick={() => changeTab('read')}
          >
            <BookOpen size={14} />
            阅读
          </button>
          <button
            id="qm-discuss-tab"
            role="tab"
            aria-selected={tab === 'discussion'}
            aria-controls="qm-discuss-panel"
            onClick={() => changeTab('discussion')}
          >
            <MessageCircle size={14} />
            讨论<span>预览</span>
          </button>
        </div>
        <div
          id="qm-discuss-panel"
          role="tabpanel"
          aria-labelledby="qm-discuss-tab"
          hidden={tab !== 'discussion'}
        >
          <QuestionDiscussion
            key={current}
            question={question}
            quotedSourceId={quote}
          />
        </div>
        <div
          id="qm-read-panel"
          role="tabpanel"
          aria-labelledby="qm-read-tab"
          hidden={tab !== 'read'}
        >
          <div className="qm-reader-actions">
            <button className="qm-primary" onClick={curatedExpand}>
              <GitBranch size={16} />
              展开相关问题
            </button>
            {state.expanded.includes(current) && (
              <button
                className="qm-collapse"
                onClick={() => {
                  setState(collapseBranch(state, current));
                  setNotice('已收起这一分支，其他来路仍然保留。');
                }}
              >
                收起分支
              </button>
            )}
          </div>
          {incoming.length > 0 && (
            <details className="qm-connection" key={`connection-${current}`}>
              <summary>
                为什么走到这里<span>{incoming[0].kind}</span>
              </summary>
              {incoming.map((l) => (
                <div className="qm-connection-item" key={l.id}>
                  <p>{l.reason}</p>
                  <small>{l.basis}</small>
                  {l.evidence.length > 0 && (
                    <details>
                      <summary>查看连接依据</summary>
                      {l.evidence.map((e) => (
                        <p key={e.sourceId}>
                          「{e.excerpt}」<br />
                          <small>
                            {
                              graph.questions
                                .flatMap((q) => q.sources)
                                .find((s) => s.id === e.sourceId)?.author
                            }
                          </small>
                        </p>
                      ))}
                    </details>
                  )}
                </div>
              ))}
            </details>
          )}
          <div className="qm-section-label">
            来自真实回答<span>片段与导读</span>
          </div>
          {question.sources.map((s, i) => (
            <article className="qm-source" key={s.id}>
              <div className="qm-source-author">
                <span className="qm-author-initial">
                  {s.author.slice(0, 1)}
                </span>
                <div>
                  <strong>{s.author}</strong>
                  <span>
                    {s.url.includes('/question/')
                      ? '回答 · 知乎'
                      : '补充阅读 · 专栏文章'}
                  </span>
                </div>
              </div>
              {i > 0 && <h3>{s.title}</h3>}
              <blockquote>{s.excerpt}</blockquote>
              <span className="qm-scope-label">搜索片段 · 非全文</span>
              {s.availability === 'unavailable' && (
                <p role="status">这条原文暂时无法访问，片段仅供回看。</p>
              )}
              <div className="qm-guide">
                <h3>阅读导引</h3>
                <p>{s.guide}</p>
              </div>
              <details className="qm-source-detail">
                <summary>适用范围与来源记录</summary>
                <p>{s.scope}</p>
                <p>
                  获取：{s.fetchedAt.slice(0, 10)} · 核查：
                  {s.checkedAt.slice(0, 10)}
                </p>
              </details>
              <div className="qm-source-actions">
                <a
                  className="qm-original"
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  阅读原文
                  <ExternalLink size={14} />
                </a>
                <button
                  className="qm-quote-discuss"
                  onClick={() => {
                    setQuote({ id: s.id });
                    changeTab('discussion');
                  }}
                >
                  <MessageCircle size={14} />
                  引用讨论
                </button>
              </div>
            </article>
          ))}
          {outgoing.length > 0 && (
            <div className="qm-next">
              <h3>接着，可以看看</h3>
              {outgoing.slice(0, 5).map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    const q = graph.questions.find((n) => n.id === l.toId);
                    if (q) {
                      setState(
                        selectQuestion(
                          addBranch(state, current, [q], [l]),
                          q.id,
                        ),
                      );
                      setReaderOpen(true);
                    }
                  }}
                >
                  <span>
                    {graph.questions.find((q) => q.id === l.toId)?.title}
                    <small>{l.kind}</small>
                  </span>
                  <ChevronRight size={17} />
                </button>
              ))}
            </div>
          )}
          <button
            className="qm-more-search"
            onClick={() => openSearch(current)}
          >
            <Search size={16} />
            换个角度，搜索更多问题
            <ArrowRight size={15} />
          </button>
          <footer className="qm-reader-footer">
            内容来自知乎作者，连接由本站整理。
            <br />
            知路为独立体验项目。<Link to="/read">原阅读版</Link>
          </footer>
        </div>
      </div>
    </aside>
  );
}
