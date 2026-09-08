import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  MarkerType,
  useReactFlow,
  useStore,
  type Node,
  type NodeProps,
  type Edge,
} from '@xyflow/react';
import { ArrowRight, Focus, Minus, Plus, BookOpen } from 'lucide-react';
import type {
  PublicQuestion,
  QuestionLink,
} from '../../../../shared/question-graph';
import type { Exploration } from '../../../../shared/graph-state';
import '@xyflow/react/dist/style.css';

type MapNode = Node<
  {
    question: PublicQuestion;
    visited: boolean;
    active: boolean;
    onSelect: (id: string) => void;
    onPreview: (id: string | null, element?: HTMLElement) => void;
  },
  'question'
>;
function QuestionNode({ data }: NodeProps<MapNode>) {
  return (
    <div
      className={`qm-node ${data.active ? 'is-current' : ''} ${data.visited ? 'is-visited' : ''}`}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <button
        className="qm-node-button nodrag"
        onClick={() => {
          data.onPreview(null);
          data.onSelect(data.question.id);
        }}
        onMouseEnter={(e) => data.onPreview(data.question.id, e.currentTarget)}
        onMouseLeave={() => data.onPreview(null)}
        onFocus={(e) => data.onPreview(data.question.id, e.currentTarget)}
        onBlur={() => data.onPreview(null)}
        aria-label={`阅读问题：${data.question.title}`}
        aria-pressed={data.active}
        aria-describedby="qm-node-preview"
      >
        <span className="qm-node-meta">
          {data.active
            ? '当前问题'
            : data.question.origin === 'search'
              ? '搜索发现'
              : data.visited
                ? '已走过'
                : '待探索'}
          <span className="qm-node-dot" />
        </span>
        <span className="qm-node-title">{data.question.title}</span>
        <span className="qm-node-foot">
          {data.question.sources.length} 段内容
          <ArrowRight size={15} />
        </span>
      </button>
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}
const nodeTypes = { question: QuestionNode };
interface CanvasProps {
  questions: PublicQuestion[];
  links: QuestionLink[];
  positions: Exploration['positions'];
  current: string;
  path: string[];
  onSelect: (id: string) => void;
  focusKey: number;
  readerOpen: boolean;
}
function Canvas({
  questions,
  links,
  positions,
  current,
  path,
  onSelect,
  focusKey,
  readerOpen,
}: CanvasProps) {
  const flow = useReactFlow<MapNode>();
  const [ready, setReady] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [peek, setPeek] = useState<{ id: string; x: number; y: number } | null>(
    null,
  );
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPreview = useCallback((id: string | null, element?: HTMLElement) => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    setHovered(id);
    setPeek(null);
    if (!id || !element) return;
    const r = element.getBoundingClientRect();
    const canvas = element.closest('.qm-canvas')!.getBoundingClientRect();
    const x = Math.max(12, Math.min(r.x - canvas.x, canvas.width - 292));
    const y =
      r.bottom + 174 < canvas.bottom
        ? r.bottom - canvas.y + 12
        : Math.max(12, r.top - canvas.y - 165);
    previewTimer.current = setTimeout(() => setPeek({ id, x, y }), 180);
  }, []);
  useEffect(() => {
    const dismiss = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onPreview(null);
    };
    window.addEventListener('keydown', dismiss);
    return () => {
      window.removeEventListener('keydown', dismiss);
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [onPreview]);
  const peekQuestion = questions.find((q) => q.id === peek?.id);
  const peekSource = peekQuestion?.sources[0];
  const mounted = useRef(false);
  const canvasWidth = useStore((state) => state.width);
  const canvasHeight = useStore((state) => state.height);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nodes: MapNode[] = useMemo(
    () =>
      questions.map((q) => ({
        id: q.id,
        type: 'question',
        position: { x: positions[q.id]?.x || 0, y: positions[q.id]?.y || 0 },
        data: {
          question: q,
          active: current === q.id,
          visited: path.includes(q.id),
          onSelect,
          onPreview,
        },
      })),
    [questions, positions, current, path, onSelect, onPreview],
  );
  const edges: Edge[] = links.map((l) => {
    const traced = path.some(
      (id, i) => id === l.fromId && path[i + 1] === l.toId,
    );
    const active = l.toId === current || l.fromId === current;
    const inspecting = hovered === l.toId || hovered === l.fromId;
    return {
      id: l.id,
      source: l.fromId,
      target: l.toId,
      type: 'default',
      style: {
        stroke: inspecting
          ? '#24583f'
          : traced
            ? '#376e4d'
            : active
              ? '#72977b'
              : '#bcccbc',
        strokeWidth: inspecting ? 2.5 : traced ? 2.5 : 1.5,
        opacity: hovered && !inspecting ? 0.32 : 1,
        transition: reduce ? 'none' : 'stroke 140ms ease, opacity 140ms ease',
        strokeDasharray: l.basis === '检索关联' ? '5 6' : undefined,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 14,
        height: 14,
        color: traced ? '#376e4d' : '#90aa94',
      },
      ariaLabel: `${l.kind}：${l.reason}`,
    };
  });
  const visibleKey = questions.map((q) => q.id).join(',');
  useEffect(() => {
    if (!ready || !canvasWidth || !canvasHeight) return;
    const timer = setTimeout(() => {
      const pos = positions[current];
      const desktop = window.innerWidth >= 900;
      if (desktop) {
        const neighbors = new Set([current]);
        if (readerOpen)
          links.forEach((l) => {
            if (l.fromId === current || l.toId === current) {
              neighbors.add(l.fromId);
              neighbors.add(l.toId);
            }
          });
        flow.fitView({
          ...(readerOpen
            ? {
                nodes: questions
                  .filter((q) => neighbors.has(q.id))
                  .map((q) => ({ id: q.id })),
              }
            : {}),
          padding: readerOpen ? 0.12 : 0.17,
          maxZoom: 1,
          minZoom: 0.3,
          duration: reduce || !mounted.current ? 0 : 180,
        });
      } else if (pos) {
        flow.setCenter(pos.x + 104, pos.y + 67, {
          zoom: 0.85,
          duration: reduce || !mounted.current ? 0 : 180,
        });
      }
      mounted.current = true;
    }, 100);
    return () => clearTimeout(timer);
  }, [
    current,
    focusKey,
    flow,
    reduce,
    positions,
    ready,
    readerOpen,
    canvasWidth,
    canvasHeight,
    visibleKey,
  ]);
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      minZoom={0.3}
      maxZoom={1.4}
      onInit={() => setReady(true)}
      zoomOnDoubleClick={false}
      onMoveStart={() => onPreview(null)}
      aria-label="问题探索图谱"
    >
      {peek && peekQuestion && (
        <div
          className="qm-hover-preview"
          id="qm-node-preview"
          role="tooltip"
          style={{ left: peek.x, top: peek.y }}
        >
          <div>
            <BookOpen size={13} />
            先看一眼<span>点击阅读</span>
          </div>
          <p>{peekSource?.excerpt || peekQuestion.title}</p>
          <small>
            {peekSource?.author || '暂无摘录'} · {peekQuestion.sources.length}{' '}
            段内容
          </small>
        </div>
      )}
      <div className="qm-zoom">
        <button
          aria-label="放大图谱"
          onClick={() => flow.zoomIn({ duration: reduce ? 0 : 160 })}
        >
          <Plus size={18} />
        </button>
        <button
          aria-label="缩小图谱"
          onClick={() => flow.zoomOut({ duration: reduce ? 0 : 160 })}
        >
          <Minus size={18} />
        </button>
        <span />
        <button
          aria-label="查看全图"
          onClick={() =>
            flow.fitView({
              padding: 0.18,
              maxZoom: 1,
              duration: reduce ? 0 : 220,
            })
          }
        >
          <Focus size={18} />
        </button>
      </div>
    </ReactFlow>
  );
}
export default function QuestionCanvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
