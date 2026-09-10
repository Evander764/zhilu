import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Search } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { searchQuestions } from '../../api';
import { explorationSchema } from '../../../../shared/graph-state';
import { topicSuggestions } from '../../../../shared/topics';
import type { PublicQuestion } from '../../../../shared/question-graph';
import './topic-home.css';

export default function TopicHome({
  onChoose,
  onResume,
}: {
  onChoose: (q: PublicQuestion) => void;
  onResume: () => void;
}) {
  const [query, setQuery] = useState('');
  const [canResume] = useState(() => {
    try {
      return explorationSchema.safeParse(
        JSON.parse(localStorage.getItem('zhilu-question-map-v2') || 'null'),
      ).success;
    } catch {
      return false;
    }
  });
  const [searched, setSearched] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<PublicQuestion[] | null>(null);
  const [error, setError] = useState('');
  const [cached, setCached] = useState(false);
  const sequence = useRef(0);
  useEffect(() => {
    document.title = '知路 · 先选一个感兴趣的话题';
    return () => {
      sequence.current++;
    };
  }, []);
  function home() {
    sequence.current++;
    setBusy(false);
    setSearched('');
    setQuery('');
    setResults(null);
    setError('');
  }
  async function search(value: string) {
    const text = value.trim();
    if (text.length < 2 || text.length > 120) return;
    const request = ++sequence.current;
    setQuery(text);
    setSearched(text);
    setBusy(true);
    setResults(null);
    setError('');
    try {
      const response = await searchQuestions(text);
      if (request !== sequence.current) return;
      setResults(response.questions);
      setCached(response.cached);
    } catch (failure) {
      if (request !== sequence.current) return;
      const data = (
        failure as {
          response?: {
            data?: { message?: string; error?: { message?: string } };
          };
        }
      ).response?.data;
      setError(
        data?.error?.message ||
          data?.message ||
          '搜索暂时没有完成，请稍后重试。',
      );
    } finally {
      if (request === sequence.current) setBusy(false);
    }
  }
  return (
    <main className="qm-app topic-home">
      <header className="qm-header">
        <button className="qm-brand topic-brand" onClick={home}>
          知路<span className="qm-brand-caption">从好奇的地方开始。</span>
        </button>
        {searched && (
          <button className="topic-back" onClick={home}>
            <ArrowLeft size={16} />
            重新选题
          </button>
        )}
      </header>
      <div className="topic-content">
        {!searched ? (
          <>
            <div className="topic-intro">
              <p className="qm-eyebrow">
                工作之外，生活之中，还有很多值得问的事
              </p>
              <h1>今天，你对什么感兴趣？</h1>
              <p>选一个话题，看看大家怎么说。</p>
            </div>
            <section className="topic-grid" aria-label="不同方向的选题">
              {topicSuggestions.map((topic, index) => (
                <button
                  className="topic-choice"
                  data-topic={topic.id}
                  key={topic.id}
                  onClick={() => void search(topic.title)}
                >
                  <span className="topic-direction">
                    <span>{topic.direction}</span>
                    <span>0{index + 1}</span>
                  </span>
                  <h2>{topic.title}</h2>
                  <span className="topic-action">
                    选这个话题
                    <ArrowRight size={18} />
                  </span>
                </button>
              ))}
            </section>
          </>
        ) : (
          <div className="topic-intro topic-result-intro">
            <p className="qm-eyebrow">你选的话题</p>
            <h1>{searched}</h1>
            <p>从搜索返回的回答里，选择一条开始阅读。</p>
          </div>
        )}
        <form
          className="topic-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            void search(query);
          }}
        >
          <label htmlFor="topic-query">
            {searched ? '也可以换个问法' : '或者，搜一个你自己的问题'}
          </label>
          <div>
            <Input
              id="topic-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              maxLength={120}
              placeholder="写下你想了解的事"
            />
            <button
              className="qm-primary"
              disabled={busy || query.trim().length < 2}
            >
              <Search size={17} />
              {busy ? '搜索中…' : '搜索'}
            </button>
          </div>
        </form>
        {busy && (
          <p className="topic-status" role="status">
            正在查找相关回答…
          </p>
        )}
        {error && (
          <div className="topic-status" role="alert">
            <p>{error}</p>
            <button
              className="qm-primary"
              onClick={() => void search(searched)}
            >
              重试这次搜索
            </button>
          </div>
        )}
        {results && (
          <section
            className="topic-results"
            aria-label="搜索结果"
            aria-live="polite"
          >
            <p>
              {results.length
                ? `找到 ${results.length} 个相关问题${cached ? ' · 五分钟内的搜索缓存' : ''}`
                : '暂时没有找到相关问题，可以换个问法或重新选题。'}
            </p>
            {results.map((q) => (
              <article key={q.id}>
                <span className="topic-result-meta">
                  {q.sources[0]?.author} · 搜索片段
                </span>
                <h2>{q.title}</h2>
                <p>{q.sources[0]?.excerpt.slice(0, 240)}</p>
                <div className="topic-result-actions">
                  <button className="qm-primary" onClick={() => onChoose(q)}>
                    阅读回答
                    <ArrowRight size={16} />
                  </button>
                  <a
                    href={q.sources[0]?.url || q.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    打开原文
                    <ArrowUpRight size={15} />
                  </a>
                </div>
              </article>
            ))}
          </section>
        )}
        {!searched && canResume && (
          <button className="topic-back" onClick={onResume}>
            继续上次阅读
            <ArrowRight size={16} />
          </button>
        )}
        <footer className="topic-foot">
          选题是探索建议。搜索后显示来源片段，完整内容可打开原文阅读。
        </footer>
      </div>
    </main>
  );
}
