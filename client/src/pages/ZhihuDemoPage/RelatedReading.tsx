import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import type {
  RelatedQuestion,
  RelatedRequest,
} from '../../../../shared/related-tree';
import { RelatedSourceExcerpt, relatedErrorMessages } from './RelatedTreeView';
import type { RelatedState } from './use-related-tree';
interface Props {
  current: RelatedRequest;
  question?: RelatedQuestion;
  title: string;
  sidebar: ReactNode;
  state: RelatedState;
}
export function RelatedReading({
  current,
  question,
  title,
  sidebar,
  state,
}: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [current.questionId]);
  return (
    <>
      <section className="zd-question-header">
        <div className="zd-question-inner">
          <div className="zd-question-main">
            <div className="zd-tags">
              <span>知乎问题</span>
            </div>
            <h1 ref={heading} tabIndex={-1}>
              {title}
            </h1>
            <p>以下仅展示官方搜索返回的片段，完整问题和回答请前往知乎阅读。</p>
            <div className="zd-question-buttons">
              <a
                className="zd-outline"
                href={`https://www.zhihu.com/question/${current.questionId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                打开知乎问题 <ExternalLink size={15} />
              </a>
              <Link to="/">返回推荐</Link>
            </div>
          </div>
        </div>
      </section>
      <main className="zd-columns zd-detail zd-related-detail">
        <div>
          <div className="zd-all-answers zd-panel">
            {!question && state.status === 'loading'
              ? '正在检索回答片段…'
              : `${question?.answers.length || 0} 个回答片段`}
          </div>
          <article
            className="zd-answer zd-panel zd-related-reading"
            aria-label="知乎搜索片段"
          >
            {question?.source && (
              <section>
                <h2>问题描述 · 搜索片段</h2>
                <RelatedSourceExcerpt source={question.source} />
              </section>
            )}
            {question?.answers.length ? (
              question.answers.map((answer) => (
                <section key={answer.answerId}>
                  <h2>
                    {answer.author || '作者未提供'}{' '}
                    <small>回答 · 搜索片段</small>
                  </h2>
                  <RelatedSourceExcerpt source={answer} />
                </section>
              ))
            ) : state.status === 'loading' ? (
              <p role="status">正在检索这个问题的回答片段…</p>
            ) : state.status === 'error' ? (
              <p role="alert">
                {relatedErrorMessages[state.error || 'service']}
              </p>
            ) : (
              <p>
                本次未取得这个问题的回答片段。可以打开知乎问题查看原文，或从相关问题中继续探索。
              </p>
            )}
          </article>
        </div>
        <aside className="zd-sidebar zd-related-sidebar">{sidebar}</aside>
      </main>
    </>
  );
}
