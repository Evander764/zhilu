import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ExternalLink, Link2 } from 'lucide-react';
import { getZhihuOAuthStatus } from '../../api';
import type {
  ZhihuOAuthCompletion,
  ZhihuOAuthStatus,
} from '../../../../shared/api.interface';
import { beginZhihuConnection, consumeZhihuCallback } from './zhihu-oauth-flow';

export function ZhihuConnection({ onLogin }: { onLogin: () => void }) {
  const [status, setStatus] = useState<ZhihuOAuthStatus | null>(null);
  const [result, setResult] = useState<ZhihuOAuthCompletion | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const flow = useRef<{
    started: boolean;
    promise: Promise<ZhihuOAuthCompletion> | null;
  }>({ started: false, promise: null });

  useEffect(() => {
    let active = true;
    void getZhihuOAuthStatus()
      .then((next: ZhihuOAuthStatus) => {
        if (active) setStatus(next);
      })
      .catch(() => {
        if (active) setError('暂时无法读取知乎连接状态，请刷新重试。');
      });
    if (!flow.current.started) {
      flow.current.started = true;
      flow.current.promise = consumeZhihuCallback();
    }
    if (flow.current.promise) {
      setBusy(true);
      void flow.current.promise
        .then((next: ZhihuOAuthCompletion) => {
          if (active) setResult(next);
        })
        .catch((reason: unknown) => {
          if (active)
            setError(
              reason instanceof Error
                ? reason.message
                : '知乎连接未完成，请重试。',
            );
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    }
    return () => {
      active = false;
    };
  }, []);

  async function connect() {
    if (!status?.signedIn) {
      onLogin();
      return;
    }
    setBusy(true);
    setError('');
    setResult(null);
    try {
      await beginZhihuConnection();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : '无法连接知乎，请重试。',
      );
      setBusy(false);
    }
  }

  return (
    <section
      className="zd-zhihu-connection"
      aria-labelledby="zhihu-connection-heading"
      data-ai-section-type="card-list"
    >
      <div className="zd-zhihu-connection-heading">
        <div>
          <h2 id="zhihu-connection-heading">
            <Link2 size={18} /> 连接知乎
          </h2>
          <p>
            {result
              ? '本次授权已完成，以下是你授权范围内的数据。'
              : status?.message || '正在读取连接状态…'}
          </p>
        </div>
        <button
          className="zd-primary"
          disabled={busy || !status?.ready}
          onClick={() => void connect()}
        >
          {busy
            ? '正在处理授权…'
            : status && !status.ready
              ? '暂未开放'
              : result
                ? '重新连接'
                : status?.signedIn
                  ? '连接知乎'
                  : '登录并连接知乎'}
        </button>
      </div>
      <p className="zd-zhihu-connection-note">
        授权后读取知乎的创作、关注和收藏，不会发布或修改知乎内容。
      </p>
      {error && (
        <p role="alert" className="zd-zhihu-connection-error">
          {error}
        </p>
      )}
      {result && (
        <div className="zd-zhihu-results" aria-live="polite">
          <p className="zd-zhihu-result-summary">
            <CheckCircle2 size={16} /> 各类最多展示 1 条，刷新页面后需重新连接。
          </p>
          {result.results.map((item) => (
            <div key={item.id} className="zd-zhihu-result">
              <div className="zd-zhihu-result-title">
                <h3>{item.name}</h3>
                <span data-status={item.status}>{item.message}</span>
              </div>
              {item.item && (
                <div>
                  {item.item.url ? (
                    <a
                      href={item.item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.item.title}
                      <ExternalLink size={13} />
                    </a>
                  ) : (
                    <strong>{item.item.title}</strong>
                  )}
                  {item.item.summary && <p>{item.item.summary}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
