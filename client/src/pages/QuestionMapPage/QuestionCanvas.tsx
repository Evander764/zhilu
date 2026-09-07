import { useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  useReactFlow,
  useNodesInitialized,
  type Node,
  type NodeProps,
  type Edge,
} from '@xyflow/react';
import { ArrowRight, Focus, Minus, Plus } from 'lucide-react';
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
        onClick={() => data.onSelect(data.question.id)}
        aria-label={`阅读问题：${data.question.title}`}
        aria-pressed={data.active}
      >
        <span className="qm-node-meta">
          {data.active
            ? '正在阅读'
            : data.question.origin === 'search'
              ? '搜索发现'
              : data.visited
                ? '已走过'
                : '知乎问题'}
          <span className="qm-node-dot" />
        </span>
        <span className="qm-node-title">{data.question.title}</span>
        <span className="qm-node-foot">
          {
            data.question.sources.filter((s) => s.url.includes('/question/'))
              .length
          }{' '}
          条回答片段
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
}
function Canvas({
  questions,
  links,
  positions,
  current,
  path,
  onSelect,
  focusKey,
}: CanvasProps) {
  const flow = useReactFlow<MapNode>();
  const initialized = useNodesInitialized();
  const mounted = useRef(false);
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
        },
      })),
    [questions, positions, current, path, onSelect],
  );
  const edges: Edge[] = links.map((l) => {
    const traced = path.some(
      (id, i) => id === l.fromId && path[i + 1] === l.toId,
    );
    const active = l.toId === current || l.fromId === current;
    return {
      id: l.id,
      source: l.fromId,
      target: l.toId,
      type: 'default',
      style: {
        stroke: traced ? '#245ad6' : active ? '#8aabd9' : '#cad3df',
        strokeWidth: traced ? 2.5 : 1.5,
        strokeDasharray: l.basis === '检索关联' ? '5 6' : undefined,
      },
      ariaLabel: `${l.kind}：${l.reason}`,
    };
  });
  useEffect(() => {
    if (!initialized) return;
    const timer = setTimeout(() => {
      if (!mounted.current) {
        const pos = positions[current];
        if (window.innerWidth < 760 && pos)
          flow.setCenter(pos.x + 124, pos.y + 68, { zoom: 0.88, duration: 0 });
        else
          flow.fitView({
            padding: 0.18,
            maxZoom: 1,
            minZoom: 0.55,
            duration: 0,
          });
        mounted.current = true;
      } else {
        const pos = positions[current];
        if (pos)
          flow.setCenter(pos.x + 124, pos.y + 68, {
            zoom:
              window.innerWidth < 760 ? 0.85 : Math.max(0.8, flow.getZoom()),
            duration: reduce ? 0 : 220,
          });
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [current, focusKey, flow, reduce, positions, initialized]);
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
      onInit={() => {}}
      zoomOnDoubleClick={false}
      aria-label="知乎问题探索图谱"
    >
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
