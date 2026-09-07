import { ArrowLeft, ChevronRight, Compass } from 'lucide-react';
import type { Exploration } from '../../../../shared/graph-state';
interface Props {
  state: Exploration;
  setState: (state: Exploration) => void;
  setReaderOpen: (open: boolean) => void;
  focus: () => void;
}
export default function QuestionTrail({
  state,
  setState,
  setReaderOpen,
  focus,
}: Props) {
  return (
    <footer className="qm-trail">
      <div className="qm-trail-controls">
        <button
          aria-label="返回上一个问题"
          disabled={state.path.length < 2}
          onClick={() => {
            setState({ ...state, path: state.path.slice(0, -1) });
            setReaderOpen(true);
          }}
        >
          <ArrowLeft size={17} />
        </button>
        <button
          aria-label="回到本次起点"
          onClick={() => {
            setState({ ...state, path: [state.path[0]] });
            focus();
          }}
        >
          <Compass size={17} />
        </button>
      </div>
      <span className="qm-trail-label">走过的路</span>
      <nav aria-label="阅读轨迹">
        {state.path.map((id, i) => (
          <button
            key={`${id}-${i}`}
            aria-current={i === state.path.length - 1 ? 'step' : undefined}
            onClick={() => {
              setState({ ...state, path: state.path.slice(0, i + 1) });
              setReaderOpen(true);
            }}
          >
            {i > 0 && <ChevronRight size={12} />}
            <span>{state.questions.find((q) => q.id === id)?.title}</span>
          </button>
        ))}
      </nav>
      <span className="qm-local">仅保存在此设备</span>
    </footer>
  );
}
