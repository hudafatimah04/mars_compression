import { useState } from 'react';
import { ChartCard, palette } from './ChartCard';
import { EvidenceCaption, FigureCard, PendingBadge, StatCard } from './Cards';
import { ConfusionHeatmap } from './ConfusionHeatmap';
import { StatsTable } from './TrainingBlocks';
import {
  auditSource, chartSources, classKeys, classNames, comma, confusion, freeze, fromBackup,
  original, roadmapSource, round, selected, splitRows,
} from '../data/training';
import results from '../../data/source/results/baseline/final_test_results.json';
import audit from '../../data/source/audit_split_summary.json';

const frozenSource = fromBackup('checkpoints/baseline/baseline_frozen.json');
const testSource = fromBackup('results/baseline/final_test_results.json');
const resultsSource = chartSources.validation + ' · ' + testSource;
const panelRoot = import.meta.env.BASE_URL + 'assets/section5/panels/';
const panelData = import.meta.glob('../../data/source/prediction_panels/*.{csv,json}', {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>;
const panelCSV = panelData['../../data/source/prediction_panels/prediction_examples.csv'];
const panelManifest = panelData['../../data/source/prediction_panels/panel_manifest.json'];
const msl = results.splits.test_msl.metrics;
const mer = results.splits.test_mer.metrics;
const groups = [
  { id: 'validation', name: 'Validation · epoch ' + freeze.selected_epoch, phase: 'validation', labels: 'crowdsourced', images: splitRows[1].images, color: palette.navy },
  { id: 'msl', name: 'Test MSL', phase: 'test', labels: 'expert', images: results.splits.test_msl.image_count, color: palette.rust },
  { id: 'mer', name: 'Test MER', phase: 'test', labels: 'expert', images: results.splits.test_mer.image_count, color: palette.grey },
] as const;
const groupSeries = groups.map(group => ({ key: group.id, name: group.name, color: group.color }));
const keys = ['miou4', 'miou3', 'pixacc'] as const;
const labels = ['mIoU4', 'mIoU3', 'Pixel accuracy'];
const scoreRows = keys.map((key, i) => ({ metric: labels[i], validation: selected[key], msl: msl[key], mer: mer[key] }));
const classMetrics = [['iou', 'IoU'], ['precision', 'Precision'], ['recall', 'Recall']] as const;

function Frozen() {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  async function copyHash() {
    try {
      await navigator.clipboard.writeText(freeze.checkpoint_sha256);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }

  return (
    <>
      <ul className="points compact">
        <li>Selected by highest validation mIoU4 before any test evaluation. Weights are never retrained or tuned for the codecs.</li>
        <li>The freeze record’s <code>test_evaluation_performed</code> is {String(freeze.test_evaluation_performed)}. The later test record is {results.status}.</li>
      </ul>
      <div className="stat-grid">
        <StatCard value={String(freeze.selected_epoch)} label={'Epoch · iteration ' + comma(freeze.selected_iteration)} />
        <StatCard value={round(freeze.validation_miou4)} label="mIoU4" badges={['validation']} />
        <div className="stat-card hash-card">
          <details><summary><strong>{freeze.checkpoint_sha256.slice(0,12)}</strong></summary>
            <code>{freeze.checkpoint_sha256}</code>
            <button type="button" className="chart-original" onClick={copyHash}>{copied ? 'Copied' : 'Copy SHA256'}</button>
            {copyError && <span role="status">Select the checksum above to copy it.</span>}
          </details>
          <span className="stat-label">Checkpoint SHA256</span>
        </div>
        <div className="stat-card hash-card"><strong>{freeze.config_hash}</strong><span className="stat-label">Config hash</span></div>
      </div>
      <small className="source">{frozenSource} · {testSource}</small>
    </>
  );
}

function Scores() {
  return (
    <>
      <ChartCard title="Uncompressed scores" type="bar" xKey="metric" xLabel="Metric" metrics={[{
        name: 'Scores', yLabel: 'Score (0–1)', rows: scoreRows, series: groupSeries, domain: [0, 1],
        evidence: {
          measured: 'Validation at the frozen epoch and expert-test metrics on original images.',
          result: `MSL mIoU4 is ${round(msl.miou4)} versus validation ${round(selected.miou4)}.`,
          meaning: 'Big Rock accounts for most of the MSL mIoU4 drop. Label source and image mix also differ, so the drop does not establish overfitting.',
          sourcePath: resultsSource,
        },
      }]} />
      <div className="table-scroll">
        <table className="research-table">
          <thead><tr>{['Split', 'Labels', 'Images', ...labels].map(name => <th scope="col" key={name}>{name}</th>)}</tr></thead>
          <tbody>{groups.map(group => (
            <tr key={group.id}><th scope="row">{group.name} <span className="badge">{group.phase}</span></th>
              <td><span className="badge">{group.labels}</span></td><td>{comma(group.images)}</td>
              {scoreRows.map(row => <td key={row.metric}>{round(row[group.id])}</td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <small className="source">{resultsSource} · validation count: data/dataset_v3_512/val.csv</small>
    </>
  );
}

function Classes() {
  return (
    <>
      <ChartCard title="Performance by terrain class" type="bar" xKey="class" xLabel="Ground-truth terrain class" emphasizeCategory="Big Rock" metrics={classMetrics.map(([key, name]) => ({
        name, yLabel: name + ' (0–1)', domain: [0, 1],
        rows: classNames.map((label, index) => ({
          class: label, validation: selected[key + '_' + classKeys[index]], msl: msl[key][index], mer: mer[key][index],
        })),
        series: groupSeries,
        evidence: {
          measured: 'Per-class ' + name + ' for the frozen model.',
          result: `Big Rock ${name}: MSL ${round(msl[key][3])}; MER ${round(mer[key][3])}.`,
          meaning: 'Soil, bedrock and sand score higher. mIoU3 excludes the weak Big Rock class.',
          sourcePath: resultsSource,
        },
      }))} />
      <div className="stat-grid">
        {[msl, mer].map((metrics, i) => <StatCard key={i} value={round(metrics.iou[3])} label={groups[i+1].name + ' · Big Rock IoU'}
          badges={['test', 'expert']} detail={`Precision ${round(metrics.precision[3])} · Recall ${round(metrics.recall[3])}`}
          sourcePath={testSource} />)}
      </div>
    </>
  );
}

function Matrices() {
  const matrices = [confusion.confusion_matrix, msl.conf, mer.conf];
  return <div className="baseline-matrices">{groups.map((group, i) => <ConfusionHeatmap key={group.id}
    title={group.name} matrix={matrices[i]} sourcePath={i === 0 ? chartSources.confusion : testSource}
    original={i === 0 ? original('confusion_epoch_16') : undefined} />)}</div>;
}

function BigRock() {
  return (
    <>
      <StatsTable headers={['Split', 'Original images with Big Rock', '512×512 images with Big Rock', 'Mean labeled fraction']}
        rows={audit.rows.map((row, i) => [splitRows[i].split, comma(row.original), comma(row.prepared), row.meanLabeled.toFixed(3)])} />
      <EvidenceCaption measured="Big Rock presence at original and prepared resolutions."
        result="Train and validation lost some Big Rock regions after resizing."
        meaning="Very small Big Rock regions can vanish during nearest-neighbor resizing."
        sourcePath={auditSource + ' and cell 36 · ' + roadmapSource + ', Appendix B'} />
    </>
  );
}

type Filter = 'All' | 'Random' | 'Big rock';

function Predictions() {
  const [filter, setFilter] = useState<Filter>('All');
  if (!panelCSV || !panelManifest) return <PendingBadge label="Prediction panels will be generated with the frozen model on Kaggle" />;

  const manifest = JSON.parse(panelManifest) as { rule: string; checkpoint_sha256: string };
  const [header, ...lines] = panelCSV.trim().split(/\r?\n/);
  const columns = header.split(',');
  const entries = lines.map(line => Object.fromEntries(line.split(',').map((value, i) => [columns[i], value])));
  const shown = entries.filter(row => filter === 'All' || (filter === 'Random' ? row.kind === 'random' : row.kind !== 'random'));
  const display = (value?: string) => value ? round(Number(value)) : '—';
  const classFields = ['Soil', 'Bedrock', 'Sand', 'Big rock'];
  return (
    <>
      <p className="short-note">{manifest.rule}.</p>
      <p className="footnote">Ground-truth overlays show annotations. Magenta marks incorrectly predicted labeled pixels.</p>
      <small className="source">website/public/assets/section5/panels/panel_manifest.json · prediction_examples.csv</small>
      <img className="prediction-legend" src={panelRoot + 'legend.png'} alt="Terrain classes and magenta error overlay legend" />
      <small className="source">website/public/assets/section5/panels/legend.png</small>
      <div className="metric-controls prediction-filter" aria-label="Filter prediction panels">
        {(['All', 'Random', 'Big rock'] as const).map(option => (
          <button type="button" key={option} aria-pressed={filter === option} onClick={() => setFilter(option)}>{option}</button>
        ))}
      </div>
      <div className="prediction-grid">
        {shown.map(row => {
          const image = 'panel_' + row.n.padStart(2, '0') + '.png';
          return <FigureCard key={row.n} src={panelRoot + image} alt={`Validation image ${row.image_id}: input, ground truth, prediction and error map`}
            measured="Frozen model prediction on one validation image."
            result={`Labeled-pixel accuracy ${display(row.pixel_acc)}.`}
            meaning="Magenta identifies errors on labeled pixels."
            sourcePath={'website/public/assets/section5/panels/' + image + ' · prediction_examples.csv'} />;
        })}
      </div>
      <StatsTable headers={['Image ID', 'Kind', 'Pixel accuracy', ...classFields.flatMap(x => [x + ' IoU', x + ' GT share'])]}
        rows={shown.map(row => [row.image_id, row.kind, display(row.pixel_acc),
          ...classFields.flatMap(x => [display(row['iou_' + x]), display(row['gt_share_' + x])])])} />
      <small className="source">website/public/assets/section5/panels/prediction_examples.csv</small>
    </>
  );
}

function Reference() {
  return (
    <>
      <p className="short-note">Compare decoded and original inputs with the same frozen model and test domain.</p>
      <p className="reference-formula">Segmentation degradation(r) = mIoU4(original test) − mIoU4(decoded test at bitrate r)</p>
      <p className="footnote">Test results are never used to tune codecs.</p>
      <small className="source">{roadmapSource}, pp. 10–11</small>
    </>
  );
}

const topics = { frozen: Frozen, scores: Scores, classes: Classes, matrices: Matrices, rocks: BigRock, predictions: Predictions, reference: Reference };
export type BaselineTopic = keyof typeof topics;
export function BaselineBlock({ topic }: { topic: BaselineTopic }) {
  const Topic = topics[topic];
  return <Topic />;
}
