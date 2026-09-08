import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CornerDownRight,
  Map as MapIcon,
  Search,
} from 'lucide-react';
import type { Graph } from '../../../../shared/api.interface';
import {
  roadmapConnections,
  roadmapReadingPath,
} from '../../../../shared/roadmap';
import './roadmap.css';

const PLACEMENTS: Record<string, [number, number]> = {
  goal: [23, 6],
  paid: [69, 2],
  practice: [9, 36],
  debug: [60, 32],
  feedback: [70, 69],
  ai: [27, 76],
};

function QuestionTitle({ title }: { title: string }) {
  const parts = title.split('，');
  return (
    <>
      {parts.map((part, index) => (
        <span className="question-title-line" key={index}>
          {part}
          {index < parts.length - 1 ? '，' : ''}
        </span>
      ))}
    </>
  );
}

export function RoadmapHome({
  graph,
  savedPath,
  onRead,
  onMap,
  onSearch,
}: {
  graph: Graph;
  savedPath: string[];
  onRead: (ids: string[]) => void;
  onMap: () => void;
  onSearch: () => void;
}) {
  const [journeyId, setJourneyId] = useState(graph.journeys[0]?.id || '');
  const [focusedId, setFocusedId] = useState(
    graph.journeys[0]?.nodeIds[0] || graph.nodes[0]?.id,
  );
  const [lines, setLines] = useState<
    { id: string; d: string; primary: boolean }[]
  >([]);
  const [canvasSize, setCanvasSize] = useState({ width: 1000, height: 680 });
  const canvas = useRef<HTMLDivElement>(null);
  const markerId = useId().replace(/:/g, '');
  const selected =
    graph.nodes.find((node) => node.id === focusedId) || graph.nodes[0];
  const journey = graph.journeys.find((item) => item.id === journeyId);
  const edges = useMemo(
    () => roadmapConnections(graph, journeyId, focusedId),
    [graph, journeyId, focusedId],
  );
  const nextEdges = graph.edges
    .filter((edge) => edge.fromId === selected?.id)
    .slice(0, 3);
  const sources = graph.sources.filter((source) =>
    selected?.sourceIds.includes(source.id),
  );
  const excerptSource = [...sources].sort(
    (a, b) => a.excerpt.length - b.excerpt.length,
  )[0];
  const readSelected = () =>
    onRead(roadmapReadingPath(graph, journeyId, selected.id));

  useLayoutEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const base = element.getBoundingClientRect();
        if (!base.width || !base.height) return;
        const nodes = new Map(
          Array.from(
            element.querySelectorAll<HTMLButtonElement>('[data-node]'),
          ).map((node) => [node.dataset.node, node.getBoundingClientRect()]),
        );
        setCanvasSize({ width: base.width, height: base.height });
        setLines(
          edges.flatMap(({ edge, primary }) => {
            const from = nodes.get(edge.fromId);
            const to = nodes.get(edge.toId);
            if (!from || !to) return [];
            const ax = from.x - base.x + from.width / 2,
              ay = from.y - base.y + from.height / 2;
            const bx = to.x - base.x + to.width / 2,
              by = to.y - base.y + to.height / 2;
            let d: string;
            if (Math.abs(bx - ax) > Math.abs(by - ay) * 1.1) {
              const sign = bx > ax ? 1 : -1;
              const x = ax + (sign * from.width) / 2,
                endX = bx - sign * (to.width / 2 + 7);
              const middle = (x + endX) / 2;
              d = `M ${x} ${ay} C ${middle} ${ay}, ${middle} ${by}, ${endX} ${by}`;
            } else {
              const sign = by > ay ? 1 : -1;
              const y = ay + (sign * from.height) / 2,
                endY = by - sign * (to.height / 2 + 7);
              const middle = (y + endY) / 2;
              d = `M ${ax} ${y} C ${ax} ${middle}, ${bx} ${middle}, ${bx} ${endY}`;
            }
            return [{ id: edge.id, d, primary }];
          }),
        );
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element
      .querySelectorAll('[data-node]')
      .forEach((node) => observer.observe(node));
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [edges]);

  if (!selected)
    return <div className="empty-state">暂时还没有可读的问题。</div>;
  const selectNode = (id: string) => {
    setFocusedId(id);
    if (!journey?.nodeIds.includes(id)) setJourneyId('');
  };

  return (
    <div className="roadmap-shell">
      <aside className="explore-sidebar">
        <p className="explore-eyebrow">选择你的出发点</p>
        <h1>
          从卡住的地方，
          <br />
          接着往下走。
        </h1>
        <div className="journey-choices" aria-label="选择阅读路线">
          {graph.journeys.map((item) => (
            <button
              key={item.id}
              aria-pressed={item.id === journeyId}
              onClick={() => {
                setJourneyId(item.id);
                setFocusedId(item.nodeIds[0]);
              }}
              data-journey={item.id}
            >
              <CornerDownRight size={23} aria-hidden="true" />
              <span className="journey-desktop-label">
                {item.title}
                <small>{item.description}</small>
              </span>
              <span className="journey-mobile-label">
                {graph.nodes.find((node) => node.id === item.nodeIds[0])?.stage}
              </span>
              {item.id === journeyId && (
                <Check className="journey-check" size={14} aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
        <div className="explore-source" aria-live="polite">
          <div className="explore-source-heading">
            <span>{selected.stage} · 一段原话</span>
            <BookOpen size={14} />
          </div>
          {excerptSource && (
            <>
              <blockquote>“{excerptSource.excerpt}”</blockquote>
              <p className="explore-author">
                {excerptSource.author}
                <span>内容片段</span>
              </p>
            </>
          )}
          <button onClick={readSelected}>
            打开导读与来源
            <ArrowUpRight size={16} />
          </button>
        </div>
        {savedPath.length > 0 && (
          <button className="explore-resume" onClick={() => onRead(savedPath)}>
            <span>
              继续上次的阅读
              <small>
                {
                  graph.nodes.find((node) => node.id === savedPath.at(-1))
                    ?.stage
                }
              </small>
            </span>
            <ArrowRight size={16} />
          </button>
        )}
        <div className="explore-sidebar-foot">
          <button onClick={onSearch}>
            <Search size={16} /> 没有合适的问题？再找找
          </button>
          <p>
            连线来自编辑整理。
            <br />
            进入阅读后，可查看连接理由与来源。
          </p>
        </div>
      </aside>

      <section className="explore-map" aria-label="探索问题路网">
        <div className="explore-map-heading">
          <span>
            <i />
            AI 时代的技能学习
          </span>
          <button onClick={onMap}>
            全部 {graph.nodes.length} 个问题
            <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="journey-strip">
          <span className="journey-strip-label">
            {journey ? '这条路线' : '当前问题'}
          </span>
          {journey ? (
            journey.nodeIds.map((id, index) => (
              <span
                className={id === selected.id ? 'strip-current' : ''}
                key={`${id}-${index}`}
              >
                {index > 0 && <ArrowRight size={12} />}
                <button onClick={() => selectNode(id)}>
                  {graph.nodes.find((node) => node.id === id)?.stage}
                </button>
              </span>
            ))
          ) : (
            <span>{selected.stage}</span>
          )}
        </div>
        <div className="explore-board" ref={canvas}>
          <svg
            className="explore-lines"
            viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
            aria-hidden="true"
          >
            <defs>
              <marker
                id={`${markerId}-primary`}
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M2 2L7 5L2 8" />
              </marker>
              <marker
                id={`${markerId}-context`}
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M2 2L7 5L2 8" />
              </marker>
            </defs>
            {lines.map((line) => (
              <path
                key={line.id}
                d={line.d}
                className={line.primary ? 'line-primary' : 'line-context'}
                markerEnd={`url(#${markerId}-${line.primary ? 'primary' : 'context'})`}
              />
            ))}
          </svg>
          {graph.nodes.map((node, index) => {
            const [left, top] = PLACEMENTS[node.id] || [
              10 + (index % 3) * 30,
              10 + Math.floor(index / 3) * 35,
            ];
            return (
              <button
                className={`explore-node ${node.id === selected.id ? 'node-selected' : ''}`}
                data-node={node.id}
                aria-pressed={node.id === selected.id}
                style={{ left: `${left}%`, top: `${top}%` }}
                onClick={() => selectNode(node.id)}
                key={node.id}
              >
                <span className="node-stage">
                  {node.stage}
                  {node.id === selected.id ? (
                    <span className="node-current-label">当前问题</span>
                  ) : (
                    <ArrowUpRight size={15} />
                  )}
                </span>
                <strong>
                  <QuestionTitle title={node.title} />
                </strong>
                {node.id === selected.id && (
                  <span className="node-source-count">
                    {sources.length} 条内容 · 导读与原话
                    <BookOpen size={14} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mobile-explore">
          <article className="mobile-current" aria-live="polite">
            <span className="node-stage">
              {selected.stage}
              <span className="node-current-label">当前问题</span>
            </span>
            <h2>
              <QuestionTitle title={selected.title} />
            </h2>
            <p>{selected.subtitle}</p>
            <button onClick={readSelected}>
              开始阅读
              <ArrowUpRight size={18} />
            </button>
          </article>
          <div className="mobile-next-heading">
            <span>接下来，你可能想问</span>
            <span>{nextEdges.length} 个方向</span>
          </div>
          {nextEdges.map((edge) => (
            <button
              className="mobile-next-node"
              key={edge.id}
              data-preview-next={edge.toId}
              onClick={() => selectNode(edge.toId)}
            >
              <span>
                <small>
                  {graph.nodes.find((node) => node.id === edge.toId)?.stage}
                </small>
                <strong>{edge.label}</strong>
              </span>
              <ArrowRight size={18} />
            </button>
          ))}
          <button className="mobile-all-nodes" onClick={onMap}>
            <MapIcon size={16} />
            查看全部问题
          </button>
        </div>
        <div className="explore-map-footer">
          <div className="map-legend">
            <span>
              <i />
              {journey ? '这条路线' : '下一问'}
            </span>
            <span>
              <i />
              相关方向
            </span>
            <small>点选问题，查看原话</small>
          </div>
          <button className="map-read-action" onClick={readSelected}>
            阅读「{selected.stage}」<ArrowRight size={18} />
          </button>
        </div>
      </section>
    </div>
  );
}
