import type { PipelineNode } from '../data/sections';

type Props = {
  nodes: readonly PipelineNode[];
  widths?: readonly number[];
  gap?: number;
};

export function PipelineDiagram({ nodes, widths, gap = 44 }: Props) {
  const height = 90;
  let offset = 1;
  const boxes = nodes.map((node, index) => {
    const width = widths?.[index] ?? 220;
    const x = offset;
    offset += width + gap;
    return { node, width, x };
  });
  const viewWidth = offset - gap + 1;
  const description = nodes.map(node => [...node.lines, node.note].filter(Boolean).join(' ')).join(' → ');

  return (
    <svg className="pipeline" viewBox={`0 0 ${viewWidth} 92`} role="img" aria-label={description}>
      {boxes.map(({ node, width, x }, index) => {
        const center = x + width / 2;
        const lineCount = node.lines.length + Number(Boolean(node.note));
        const firstY = height / 2 - (lineCount - 1) * 13;
        return (
          <g key={x}>
            {index > 0 && (
              <path className="pipeline-arrow" d={`M ${x - gap + 7},45 H ${x - 8} m -7,-7 l 7,7 -7,7`} />
            )}
            <rect className={node.accent ? 'pipeline-accent' : 'pipeline-box'} x={x} y="1" width={width} height={height} rx="10" />
            <text className={node.accent ? 'pipeline-label pipeline-label-accent' : 'pipeline-label'} textAnchor="middle" dominantBaseline="central">
              {node.lines.map((line, lineIndex) => (
                <tspan key={lineIndex} x={center} y={firstY + lineIndex * 26}>{line}</tspan>
              ))}
              {node.note && <tspan className="pipeline-note" x={center} y={firstY + node.lines.length * 26}>{node.note}</tspan>}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
