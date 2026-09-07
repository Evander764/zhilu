import { ArrowRight, ExternalLink, X } from 'lucide-react';
import { Input } from '../../components/ui/input';
import type { PublicQuestion } from '../../../../shared/question-graph';
interface Props {
  searchContext: string | null;
  query: string;
  setQuery: (query: string) => void;
  busy: boolean;
  results: PublicQuestion[] | null;
  close: () => void;
  runSearch: () => Promise<void>;
  addDiscovery: (question: PublicQuestion) => void;
}
export default function QuestionSearchPanel({
  searchContext,
  query,
  setQuery,
  busy,
  results,
  close,
  runSearch,
  addDiscovery,
}: Props) {
  return (
    <section className="qm-search-panel" aria-label="搜索发现">
      <div className="qm-panel-heading">
        <div>
          <h2>{searchContext ? '从当前问题继续找' : '搜索知乎问题'}</h2>
          <p>发现新问题，再加入你的探索。</p>
        </div>
        <button
          aria-label="关闭搜索"
          onClick={() => {
            close();
          }}
        >
          <X size={20} />
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch();
        }}
      >
        <Input
          aria-label="搜索问题"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={120}
          placeholder="输入你想了解的问题"
        />
        <button
          className="qm-primary"
          disabled={busy || query.trim().length < 2}
        >
          {busy ? '搜索中…' : '搜索'}
        </button>
      </form>
      <div className="qm-search-results">
        {results === null ? (
          <p className="qm-search-hint">
            搜索只帮助发现相关内容。新分支会标为检索关联，和核对过的精选关系区分。
          </p>
        ) : results.length === 0 ? (
          <p>没有找到新的问题，试着换几个关键词。</p>
        ) : (
          results.map((q) => (
            <article key={q.id}>
              <h3>{q.title}</h3>
              <p>{q.sources[0]?.excerpt.slice(0, 180)}</p>
              <small>{q.sources[0]?.author} · 搜索片段</small>
              <div>
                <a href={q.url} target="_blank" rel="noopener noreferrer">
                  知乎原问题
                  <ExternalLink size={12} />
                </a>
                <button onClick={() => addDiscovery(q)}>
                  加入图谱
                  <ArrowRight size={14} />
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
