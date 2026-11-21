import { useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart,
  ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { EvidenceCaption } from './Cards';
import { Lightbox } from './Lightbox';
import type { Evidence } from '../data/sections';
import type { ChartRow } from '../data/training';

export const palette = { rust: '#a34028', navy: '#192c40', grey: '#687784', light: '#a4adb6', faint: '#b8bfc6' };

export type Series = { key: string; name: string; color: string; dash?: string; dots?: boolean };
export type ChartMetric = {
  name: string;
  yLabel: string;
  rows: ChartRow[];
  series: Series[];
  evidence: Evidence;
  domain?: [number | 'auto', number | 'auto'];
  original?: string;
  scale?: 'log';
  clip?: boolean;
  scientific?: boolean;
  marked?: { x: number | string; y: number; small?: boolean }[];
  referenceX?: number;
};

type Props = {
  title: string;
  xKey: string;
  xLabel: string;
  metrics: ChartMetric[];
  type?: 'line' | 'bar';
  highlightCategory?: number | string;
  emphasizeCategory?: string;
  xTicks?: number[];
  xFormat?: (value: number) => string;
  barLabels?: (value: number) => string;
};

export function ChartCard({ title, xKey, xLabel, metrics, type = 'line', highlightCategory, emphasizeCategory, xTicks, xFormat, barLabels }: Props) {
  const [metricIndex, setMetricIndex] = useState(0);
  const metric = metrics[metricIndex];
  const axes = [
    <CartesianGrid key="grid" stroke="#e2ddd6" strokeDasharray="3 4" vertical={false} />,
    <XAxis key="x" dataKey={xKey} type={type === 'line' ? 'number' : 'category'} domain={type === 'line' ? ['dataMin', 'dataMax'] : undefined} label={{ value: xLabel, position: 'insideBottom', offset: -4 }} ticks={xTicks} interval={xTicks ? 0 : undefined} tickFormatter={xFormat} tickMargin={8} height={43} />,
    <YAxis key="y" label={{ value: metric.yLabel, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }} scale={metric.scale ?? 'linear'} allowDataOverflow={metric.clip} domain={metric.domain ?? [0, 'auto']} width={88} tickFormatter={metric.scientific ? value => Number(value).toExponential(1) : undefined} />,
    <Tooltip key="tooltip" formatter={(value, name) => [String(value), name]} labelFormatter={value => `${xLabel}: ${String(value)}`} />,
    <Legend key="legend" verticalAlign="top" height={35} />,
  ];
  const margin = { top: 13, right: 28, bottom: 12, left: 9 };

  return (
    <div className="chart-card" aria-label={title}>
      <div className="chart-toolbar">
        <h3>{title}</h3>
        {metrics.length > 1 && (
          <div className="metric-controls" aria-label={title + ' metrics'}>
            {metrics.map((item, index) => (
              <button key={item.name} type="button" aria-pressed={index === metricIndex} onClick={() => setMetricIndex(index)}>{item.name}</button>
            ))}
          </div>
        )}
      </div>
      <div className="chart-plot">
        <ResponsiveContainer width="100%" height="100%">
          {type === 'bar' ? (
            <BarChart data={metric.rows} margin={margin}>
              {axes}
              {metric.series.map(series => (
                <Bar key={series.key} dataKey={series.key} name={series.name} fill={series.color} isAnimationActive={false} maxBarSize={55}>
                  {(highlightCategory !== undefined || emphasizeCategory) && metric.rows.map(row => (
                    <Cell key={String(row[xKey])} fill={row[xKey] === highlightCategory ? palette.rust : series.color} fillOpacity={emphasizeCategory && row[xKey] !== emphasizeCategory ? 0.68 : 1} />
                  ))}
                  {barLabels && <LabelList position="top" offset={5} style={{ fontSize: 12, fill: palette.navy }} formatter={value => barLabels(Number(value))} />}
                </Bar>
              ))}
            </BarChart>
          ) : (
            <LineChart data={metric.rows} margin={margin}>
              {axes}
              {metric.referenceX !== undefined && <ReferenceLine x={metric.referenceX} stroke={palette.rust} strokeDasharray="5 5" />}
              {metric.series.map(series => (
                <Line key={series.key} type="linear" dataKey={series.key} name={series.name} stroke={series.color}
                  strokeWidth={series.color === palette.faint ? 1 : 2.4} strokeDasharray={series.dash}
                  dot={series.dots ? { r: 2.5 } : false} connectNulls isAnimationActive={false} />
              ))}
              {metric.marked?.map((point, index) => (
                <ReferenceDot key={index} x={point.x} y={point.y} r={point.small ? 4 : 6} fill={point.small ? palette.grey : palette.rust} stroke="white" strokeWidth={1.5} />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      <EvidenceCaption {...metric.evidence} />
      {metric.original && (
        <Lightbox src={metric.original} alt={title + ' archived plot'} className="chart-original">View original figure</Lightbox>
      )}
    </div>
  );
}
