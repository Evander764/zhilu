import { useEffect, useState } from 'react';
import { MessageCircle, Quote, X, FileText } from 'lucide-react';
import type { PublicQuestion } from '../../../../shared/question-graph';
import {
  discussionDraftKey,
  emptyDiscussionDraft,
  readDiscussionDraft,
} from '../../../../shared/discussion-draft';

export default function QuestionDiscussion({
  question,
  quotedSourceId,
}: {
  question: PublicQuestion;
  quotedSourceId: { id: string } | null;
}) {
  const [draft, setDraft] = useState(() => {
    try {
      return readDiscussionDraft(
        localStorage.getItem(discussionDraftKey(question.id)),
        question,
      );
    } catch {
      return emptyDiscussionDraft();
    }
  });
  const [status, setStatus] = useState('');
  useEffect(() => {
    if (
      quotedSourceId &&
      question.sources.some((s) => s.id === quotedSourceId.id)
    ) {
      setDraft((d) => ({ ...d, sourceId: quotedSourceId.id }));
      setStatus('已引用这段原话，可以在下面写下想追问的内容。');
    }
  }, [quotedSourceId, question]);
  useEffect(() => {
    try {
      localStorage.setItem(
        discussionDraftKey(question.id),
        JSON.stringify(draft),
      );
    } catch {
      setStatus('当前浏览器无法保存。请先复制文字，避免丢失。');
    }
  }, [draft, question.id]);
  const source = question.sources.find((s) => s.id === draft.sourceId);
  function save() {
    try {
      localStorage.setItem(
        discussionDraftKey(question.id),
        JSON.stringify(draft),
      );
      setStatus('草稿已保存在此设备，尚未发送。');
    } catch {
      setStatus('当前浏览器无法保存。请先复制文字，避免丢失。');
    }
  }
  return (
    <section className="qm-discussion" aria-label="当前问题的讨论草稿">
      <div className="qm-discussion-status">
        <span />
        讨论预览 · 尚未联网
      </div>
      <div className="qm-discussion-intro">
        <MessageCircle size={23} strokeWidth={1.5} />
        <h3>把没说清的地方，接着聊。</h3>
        <p>
          围绕这个问题追问，或补充自己试过的办法。也可以回到阅读，引用一段原话。
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <fieldset className="qm-discussion-kind">
          <legend>你想聊什么</legend>
          <label>
            <input
              type="radio"
              name="discussion-kind"
              value="question"
              checked={draft.kind === 'question'}
              onChange={() => setDraft((d) => ({ ...d, kind: 'question' }))}
            />
            我想追问
          </label>
          <label>
            <input
              type="radio"
              name="discussion-kind"
              value="experience"
              checked={draft.kind === 'experience'}
              onChange={() => setDraft((d) => ({ ...d, kind: 'experience' }))}
            />
            我试过
          </label>
        </fieldset>
        {source && (
          <div className="qm-discussion-quote">
            <div>
              <Quote size={13} />
              引用 {source.author}
              <button
                type="button"
                aria-label="移除引用"
                onClick={() => setDraft((d) => ({ ...d, sourceId: null }))}
              >
                <X size={13} />
              </button>
            </div>
            <blockquote>{source.excerpt}</blockquote>
          </div>
        )}
        <label className="qm-composer-label" htmlFor="qm-discussion-body">
          先记下想讨论的内容
        </label>
        <textarea
          id="qm-discussion-body"
          maxLength={2000}
          placeholder={
            draft.kind === 'question'
              ? '哪里还不明白？具体卡在了哪一步？'
              : '你试了什么？结果如何？哪些条件可能不同？'
          }
          value={draft.body}
          onChange={(e) => {
            setDraft((d) => ({ ...d, body: e.target.value }));
            setStatus('');
          }}
        />
        <div className="qm-composer-footer">
          <small>{draft.body.length} / 2000</small>
          <button
            type="submit"
            className="qm-primary"
            disabled={!draft.body.trim()}
          >
            <FileText size={14} />
            保存草稿
          </button>
        </div>
        <p className="qm-discussion-note">
          草稿自动保存在此设备。讨论开放后，会在知路内交流，不会同步为原站评论。
        </p>
        <p role="status" className="qm-draft-status">
          {status}
        </p>
      </form>
    </section>
  );
}
