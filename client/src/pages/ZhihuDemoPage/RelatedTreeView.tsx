import { Link } from 'react-router-dom';
import { ChevronRight, ExternalLink } from 'lucide-react';
import {
  relatedQuestionPath,
  type RelatedRequest,
  type RelatedSource,
} from '../../../../shared/related-tree';
import type { RelatedState } from './use-related-tree';

export function RelatedSourceExcerpt({ source }: { source: RelatedSource }) {
  return (
    <div className="zd-related-excerpt">
      <p>{source.excerpt || '此条搜索结果未提供片段。'}</p>
      <a href={source.url} target="_blank" rel="noopener noreferrer">
        到知乎阅读原文 <ExternalLink size={12} />
      </a>
    </div>
  );
}
export const relatedErrorMessages = {
  auth: '知乎搜索授权暂不可用，请联系应用维护者。当前正文仍可阅读。',
  rate: '搜索次数或频率已达上限，请稍后再试。当前正文仍可阅读。',
  service: '相关问题暂时无法加载，请稍后再试。当前正文仍可阅读。',
  network: '未能连接搜索服务，请检查网络后重试。当前正文仍可阅读。',
  input: '这个问题暂时无法检索，请返回推荐选择其他问题。',
};
interface Props {
  current: RelatedRequest;
  state: RelatedState;
  retry: () => void;
  onSelect: () => void;
}
export function RelatedTreeView({ current, state, retry, onSelect }: Props) {
  return (
    <nav className="zd-related-tree" aria-label="相关问题树">
      <div className="zd-related-current" aria-current="page">
        <small>当前问题</small>
        <strong>{current.query}</strong>
      </div>
      <p className="zd-related-note">知乎搜索相关结果 · 回答按原问题归组</p>
      {state.status === 'loading' && (
        <p role="status" className="zd-related-status">
          正在检索相关问题…
        </p>
      )}
      {state.status === 'error' && (
        <div role="alert" className="zd-related-status">
          <p>{relatedErrorMessages[state.error || 'service']}</p>
          <button onClick={retry}>重试搜索</button>
        </div>
      )}
      {state.status === 'ready' && state.tree && (
        <>
          {!state.tree.questions.length && !state.tree.articles.length && (
            <p role="status" className="zd-related-status">
              没有找到相关问题或文章。可以继续阅读当前正文。
            </p>
          )}
          <ul className="zd-related-branches">
            {state.tree.questions.map((question) => (
              <li key={question.questionId} className="zd-related-question">
                {question.questionId === current.questionId ? (
                  <strong className="zd-related-self">
                    当前问题的搜索结果
                  </strong>
                ) : (
                  <Link
                    to={relatedQuestionPath(question)}
                    onClick={onSelect}
                    className="zd-related-link"
                  >
                    <span>{question.title}</span>
                    <ChevronRight size={15} />
                  </Link>
                )}
                {question.source && (
                  <details className="zd-related-answer">
                    <summary>问题描述 · 搜索片段</summary>
                    <RelatedSourceExcerpt source={question.source} />
                  </details>
                )}
                {question.answers.length > 0 && (
                  <ul className="zd-related-answers">
                    {question.answers.map((answer) => (
                      <li key={answer.answerId}>
                        <details className="zd-related-answer">
                          <summary>
                            <span>{answer.author || '作者未提供'}</span>
                            <small>回答 · 搜索片段</small>
                          </summary>
                          <RelatedSourceExcerpt source={answer} />
                        </details>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          {state.tree.articles.length > 0 && (
            <section className="zd-related-supplement">
              <h3>补充阅读</h3>
              <ul>
                {state.tree.articles.map((article) => (
                  <li key={article.articleId}>
                    <details className="zd-related-answer">
                      <summary>
                        <span>{article.title}</span>
                        <small>
                          {article.author || '作者未提供'} · 文章片段
                        </small>
                      </summary>
                      <RelatedSourceExcerpt source={article} />
                    </details>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="zd-related-note">
            搜索片段不代表全文；相关性不代表作者之间存在引用关系。
          </p>
        </>
      )}
    </nav>
  );
}
