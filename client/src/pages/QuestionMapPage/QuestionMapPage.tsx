import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  BookOpen,
  Check,
  GitBranch,
  List,
  Search,
  X,
} from 'lucide-react';
import { resolveAppUrl } from '@lark-apaas/client-toolkit/utils/resolveAppUrl';
import {
  getQuestionGraph,
  getQuestion,
  searchQuestions,
  expandQuestion,
} from '../../api';
import {
  addBranch,
  explorationSchema,
  parseShare,
  restoreShare,
  selectQuestion,
  startExploration,
  startFromSearch,
  toShare,
  type Exploration,
} from '../../../../shared/graph-state';
import type {
  PublicQuestion,
  QuestionGraph,
} from '../../../../shared/question-graph';
import QuestionCanvas from './QuestionCanvas';
import QuestionReader from './QuestionReader';
import QuestionSearchPanel from './QuestionSearchPanel';
import QuestionTrail from './QuestionTrail';
import SharePathDialog from './SharePathDialog';
import QuestionHeader from './QuestionHeader';
import TopicHome from './TopicHome';
import './question-map.css';
import './question-map-forest.css';
const STORAGE_KEY = 'zhilu-question-map-v2';
function errorText(error: unknown): string {
  const value = error as {
    response?: { data?: { message?: string; error?: { message?: string } } };
  };
  const message =
    value.response?.data?.error?.message || value.response?.data?.message;
  return typeof message === 'string'
    ? message
    : '暂时无法完成，请稍后重试。已有图谱仍可阅读。';
}
export default function QuestionMapPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<PublicQuestion | null>(null);
  const [shared, setShared] = useState(
    () =>
      new URLSearchParams(location.hash.slice(1)).has('graph') ||
      new URLSearchParams(location.search).has('journey'),
  );
  function home() {
    setSelected(null);
    setShared(false);
    navigate('/map', { replace: true });
  }
  return selected || shared ? (
    <ReadingMapPage initialQuestion={selected} onHome={home} />
  ) : (
    <TopicHome onChoose={setSelected} onResume={() => setShared(true)} />
  );
}
function ReadingMapPage({
  initialQuestion,
  onHome,
}: {
  initialQuestion: PublicQuestion | null;
  onHome: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [graph, setGraph] = useState<QuestionGraph | null>(null);
  const [state, updateState] = useState<Exploration | null>(null);
  const [notice, setNotice] = useState('');
  const [fatal, setFatal] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicQuestion[] | null>(null);
  const [searchContext, setSearchContext] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [readerOpen, setReaderOpen] = useState(Boolean(initialQuestion));
  const [shareUrl, setShareUrl] = useState('');
  const [focusKey, setFocusKey] = useState(0);
  const reader = useRef<HTMLDivElement>(null);
  const scrolls = useRef<Record<string, number>>({});
  const requestNumber = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  function setState(
    next:
      | Exploration
      | null
      | ((old: Exploration | null) => Exploration | null),
  ) {
    const previous = stateRef.current;
    if (
      previous &&
      reader.current &&
      reader.current.closest('aside')?.dataset.readerTab !== 'discussion'
    )
      scrolls.current[previous.path.at(-1)!] = reader.current.scrollTop;
    updateState(next);
  }
  const current = state?.path.at(-1) || '';
  const question = state?.questions.find((q) => q.id === current);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getQuestionGraph();
        if (cancelled) return;
        setGraph(data);
        let next = initialQuestion
          ? startFromSearch(initialQuestion)
          : startExploration(data, data.journeys[0].questionIds[0]);
        const journey = new URLSearchParams(location.search).get('journey');
        const raw = new URLSearchParams(location.hash.slice(1)).get('graph');
        if (raw) {
          const shared = parseShare(raw);
          if (shared) {
            const loaded = await Promise.allSettled(
              shared.ids.map((id) => getQuestion(id)),
            );
            if (cancelled) return;
            const questions = loaded.flatMap((r) =>
              r.status === 'fulfilled' ? [r.value] : [],
            );
            next = restoreShare(shared, questions, data);
            const missing = shared.ids.filter(
              (id) => !questions.some((q) => q.id === id),
            );
            if (missing.length)
              setNotice(
                `${missing.length} 个分享问题暂不可用，已保留其余路径。`,
              );
          } else setNotice('这个分享链接无效，已回到精选起点。');
        } else if (journey) {
          const chosen = data.journeys.find((j) => j.id === journey);
          if (chosen) next = startExploration(data, chosen.questionIds[0]);
          else setNotice('这条示范路径不存在，已回到精选起点。');
        } else if (!initialQuestion) {
          try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
              const parsed = explorationSchema.safeParse(JSON.parse(saved));
              if (parsed.success) next = parsed.data;
              else setNotice('设备中的旧进度已无法恢复，已回到起点。');
            }
          } catch {
            setNotice(
              '当前浏览器无法读取设备进度，可以继续探索并使用分享保存。',
            );
          }
        }
        scrolls.current = next.scrolls;
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          setNotice('设备保存不可用，请使用分享链接保留路径。');
        }
        setState(next);
        // Import once, then refresh resumes this device's subsequent exploration.
        if (raw || journey) navigate('/map', { replace: true });
      } catch (error) {
        if (!cancelled) setFatal(errorText(error));
      }
    }
    void load();
    return () => {
      cancelled = true;
      requestNumber.current++;
    };
  }, [location.search, location.hash, navigate, initialQuestion]);
  useEffect(() => {
    if (!state) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...state, scrolls: scrolls.current }),
      );
    } catch {
      setNotice('设备保存不可用，请使用分享链接保留路径。');
    }
  }, [state]);
  useEffect(() => {
    if (reader.current)
      reader.current.scrollTop = scrolls.current[current] || 0;
  }, [current, readerOpen]);
  useEffect(() => {
    const persist = () => {
      if (!stateRef.current) return;
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ ...stateRef.current, scrolls: scrolls.current }),
        );
      } catch {
        /* A visible save action and share fallback remain available. */
      }
    };
    window.addEventListener('pagehide', persist);
    return () => window.removeEventListener('pagehide', persist);
  }, []);
  const choose = useCallback((id: string) => {
    requestNumber.current++;
    setBusy(false);
    setState((s) => (s ? selectQuestion(s, id) : s));
    setReaderOpen(true);
    setResults(null);
    setSearchOpen(false);
    setListOpen(false);
  }, []);
  function curatedExpand() {
    if (!state || !graph || !question) return;
    const links = graph.links.filter((l) => l.fromId === current).slice(0, 5);
    if (links.length) {
      setState(
        addBranch(
          state,
          current,
          links
            .map((l) => graph.questions.find((q) => q.id === l.toId)!)
            .filter(Boolean),
          links,
        ),
      );
      setNotice('已展开核对过的相关问题，点击分支继续阅读。');
    } else openSearch(current);
  }
  function openSearch(context: string | null) {
    requestNumber.current++;
    setBusy(false);
    setSearchContext(context);
    setQuery(
      context
        ? state?.questions.find((q) => q.id === context)?.title.slice(0, 120) ||
            ''
        : '',
    );
    setResults(null);
    setSearchOpen(true);
    setReaderOpen(false);
  }
  async function runSearch() {
    if (query.trim().length < 2) {
      setNotice('请输入至少两个字符。');
      return;
    }
    const number = ++requestNumber.current;
    setBusy(true);
    setResults(null);
    setNotice('');
    try {
      const result = searchContext
        ? await expandQuestion(searchContext, query)
        : await searchQuestions(query);
      if (number !== requestNumber.current) return;
      setResults(result.questions);
      if (!result.questions.length)
        setNotice('没有找到新的问题。可以换几个词继续找，或回到精选分支。');
    } catch (error) {
      if (number === requestNumber.current) setNotice(errorText(error));
    } finally {
      if (number === requestNumber.current) setBusy(false);
    }
  }
  function addDiscovery(q: PublicQuestion) {
    if (!state) return;
    if (
      state.questions.length >= 60 &&
      !state.questions.some((n) => n.id === q.id)
    ) {
      setNotice('这张图已有 60 个问题，请保存后从新问题出发。');
      return;
    }
    const parent = searchContext || current;
    if (parent === q.id) {
      choose(q.id);
      return;
    }
    const link = graph?.links.find(
      (l) => l.fromId === parent && l.toId === q.id,
    ) || {
      id: `search-${parent}-${q.id}`,
      fromId: parent,
      toId: q.id,
      kind: '检索关联' as const,
      basis: '检索关联' as const,
      reason: searchContext
        ? '从当前问题的检索中发现；尚未核对为前提或步骤关系。'
        : '自由搜索后加入当前探索的分支；由你选择的来路，不代表语义关系已经核对。',
      evidence: [],
    };
    const next = addBranch(state, parent, [q], [link]);
    setState(selectQuestion(next, q.id));
    setSearchOpen(false);
    setReaderOpen(true);
    setResults(null);
  }
  function save() {
    if (!state) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...state, scrolls: scrolls.current }),
      );
      setNotice('已保存在当前设备，刷新后可以继续。');
    } catch {
      setNotice('设备保存不可用，请使用分享链接。');
    }
  }
  function share() {
    if (!state) return;
    setShareUrl(
      resolveAppUrl(
        `/map#graph=${encodeURIComponent(JSON.stringify(toShare(state)))}`,
      ),
    );
  }
  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setNotice('分享链接已复制。');
    } catch {
      setNotice('浏览器未允许复制，请在分享框中选择链接手动复制。');
    }
  }
  if (fatal)
    return (
      <main className="qm-error">
        <h1>图谱暂时无法打开</h1>
        <p>{fatal}</p>
        <button
          onClick={() => {
            setFatal('');
            setFocusKey((k) => k + 1);
            window.location.reload();
          }}
        >
          重新加载
        </button>
        <Link to="/read">打开原阅读版</Link>
      </main>
    );
  if (!graph || !state || !question)
    return (
      <main className="qm-loading">
        <GitBranch size={30} />
        <p>正在铺开问题之间的路…</p>
      </main>
    );
  const visibleQuestions = state.questions.filter((q) =>
    state.visible.includes(q.id),
  );
  const visibleLinks = state.links.filter(
    (l) =>
      state.visible.includes(l.fromId) &&
      state.visible.includes(l.toId) &&
      state.expanded.includes(l.fromId),
  );
  const incoming = visibleLinks.filter((l) => l.toId === current);
  const outgoing = graph.links.filter((l) => l.fromId === current);
  const activeJourney = graph.journeys.find(
    (j) => j.questionIds[0] === state.path[0],
  );
  const previewSource = [...question.sources].sort(
    (a, b) => a.excerpt.length - b.excerpt.length,
  )[0];
  const design =
    process.env.NODE_ENV !== 'production'
      ? new URLSearchParams(location.search).get('design') || 'candidate'
      : 'candidate';
  return (
    <main className={`qm-app qm-design-${design}`}>
      <a
        className="qm-skip"
        href="#qm-reader"
        onClick={(e) => {
          e.preventDefault();
          setReaderOpen(true);
          requestAnimationFrame(() =>
            document.getElementById('qm-reader')?.focus(),
          );
        }}
      >
        跳到回答阅读
      </a>
      <QuestionHeader
        save={save}
        share={share}
        openSearch={openSearch}
        onHome={onHome}
      />
      <section
        className={`qm-workspace ${readerOpen ? 'reader-open' : 'reader-closed'}`}
        aria-label="问题探索工作区"
      >
        <div className="qm-map-area">
          <div className="qm-map-intro">
            <span className="qm-eyebrow">选择你的出发点</span>
            <h1>
              从卡住的地方，
              <br />
              接着往下走。
            </h1>
            <p>从一个真实的问题开始。</p>
            <button className="qm-primary" onClick={onHome}>
              重新选择选题
            </button>
            {previewSource && (
              <div className="qm-preview-source" aria-live="polite">
                <div>
                  <span>当前问题 · 一段原话</span>
                  <BookOpen size={14} />
                </div>
                <blockquote>“{previewSource.excerpt}”</blockquote>
                <p>
                  {previewSource.author}
                  <small>内容片段</small>
                </p>
                <button onClick={() => setReaderOpen(true)}>
                  打开导读与来源
                  <ArrowUpRight size={16} />
                </button>
              </div>
            )}
            <div className="qm-intro-foot">
              <button onClick={() => openSearch(null)}>
                <Search size={15} />
                没有合适的问题？再找找
              </button>
              <p>
                连线来自编辑整理或检索关联。
                <br />
                进入阅读后，可查看理由与来源。
              </p>
            </div>
          </div>
          <div className="qm-canvas-caption">
            <span>
              <i />
              {activeJourney?.title || '沿着好奇，继续探索'}
            </span>
            <button onClick={() => setReaderOpen(!readerOpen)}>
              {readerOpen ? '收起阅读，查看地图' : '阅读当前问题'}
              <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="qm-canvas">
            <QuestionCanvas
              questions={visibleQuestions}
              links={visibleLinks}
              positions={state.positions}
              current={current}
              path={state.path}
              onSelect={choose}
              focusKey={focusKey}
              readerOpen={readerOpen}
            />
          </div>
          <div className="qm-map-bottom">
            <div className="qm-legend">
              <span>
                <i />
                精选关系
              </span>
              <span>
                <i className="dashed" />
                检索关联
              </span>
            </div>
            <button
              className="qm-list-toggle"
              onClick={() => setListOpen(!listOpen)}
              aria-expanded={listOpen}
            >
              <List size={16} />
              问题列表 · {visibleQuestions.length}
            </button>
          </div>
          {listOpen && (
            <section className="qm-list" aria-label="可访问的问题列表">
              <div className="qm-panel-heading">
                <h2>图中的问题</h2>
                <button
                  aria-label="关闭问题列表"
                  onClick={() => setListOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
              {visibleQuestions.map((q) => (
                <button
                  key={q.id}
                  onClick={() => choose(q.id)}
                  aria-current={q.id === current ? 'true' : undefined}
                >
                  {q.id === current ? (
                    <Check size={15} />
                  ) : (
                    <span className="qm-list-dot" />
                  )}
                  {q.title}
                </button>
              ))}
            </section>
          )}
        </div>
        <QuestionReader
          state={state}
          graph={graph}
          question={question}
          current={current}
          readerOpen={readerOpen}
          setReaderOpen={setReaderOpen}
          reader={reader}
          scrolls={scrolls}
          incoming={incoming}
          outgoing={outgoing}
          setState={setState}
          setNotice={setNotice}
          curatedExpand={curatedExpand}
          openSearch={openSearch}
        />
      </section>
      <QuestionTrail
        state={state}
        setState={setState}
        setReaderOpen={setReaderOpen}
        focus={() => setFocusKey((k) => k + 1)}
      />

      {notice && (
        <div className="qm-notice" role="status">
          <span>{notice}</span>
          <button aria-label="关闭提示" onClick={() => setNotice('')}>
            <X size={15} />
          </button>
        </div>
      )}
      {searchOpen && (
        <QuestionSearchPanel
          searchContext={searchContext}
          query={query}
          setQuery={setQuery}
          busy={busy}
          results={results}
          close={() => {
            requestNumber.current++;
            setBusy(false);
            setSearchOpen(false);
          }}
          runSearch={runSearch}
          addDiscovery={addDiscovery}
        />
      )}

      <SharePathDialog
        shareUrl={shareUrl}
        setShareUrl={setShareUrl}
        copyShare={copyShare}
      />
    </main>
  );
}
