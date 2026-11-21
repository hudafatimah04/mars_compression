import { ChartCard, palette, type ChartMetric, type Series } from './ChartCard';
import { EvidenceCaption, FigureCard, StatCard } from './Cards';
import { ConfusionHeatmap } from './ConfusionHeatmap';
import auditSummary from '../../data/source/audit_split_summary.json';
import { PipelineDiagram } from './PipelineDiagram';
import {
  auditSource, bestLoss, bestRock, chartSources, classKeys, classNames, comma, confusion,
  freeze, fromBackup, lastTrain, lastVal, lossRows, original, pilotProtocol, pilotRuns, protocol,
  roadmapSource, round, seedSearch, selected, selection, splitRows, tracking, trainRows, valRows, wandbExports,
  type ChartRow,
} from '../data/training';

const classColors = [palette.navy, palette.grey, palette.light, palette.rust];
const classSeries = (prefix: string): Series[] => classKeys.map((key, i) => ({
  key: prefix + key, name: classNames[i], color: classColors[i], dash: i === 1 ? '6 3' : i === 2 ? '2 3' : undefined,
}));
const metrics = [['miou4', 'mIoU4'], ['miou3', 'mIoU3'], ['val_loss', 'Validation loss']] as const;
const trainingMetrics = [['loss', 'Batch loss'], ['lr', 'Learning rate'], ['grad_norm', 'Gradient norm'], ['skipped_steps_total', 'Skipped AMP steps']] as const;

function pilotMetric(key: string, name: string, split: 'validation' | 'training'): ChartMetric {
  const series = pilotRuns.map((run, index) => ({
    key: run.tag, name: run.label, color: run.lr === selection.selected_lr ? palette.rust : index === 0 ? palette.navy : palette.grey,
    dash: index === 2 ? '6 3' : undefined, dots: split === 'validation',
  }));
  const rows = pilotRuns[0][split].map((row, index) => ({
    iteration: row.iteration,
    ...Object.fromEntries(pilotRuns.map(run => {
      const point = run[split][index];
      if (point.iteration !== row.iteration) throw new Error('Pilot log iteration mismatch');
      return [run.tag, point[key]];
    })),
  }));

  return {
    domain: split === 'validation' && key !== 'val_loss' ? key === 'miou4' ? [0.65, 0.85] : [0.87, 0.95] : undefined,
    name, yLabel: name + (key === 'skipped_steps_total' ? ' (count)' : ' (unitless)'), rows, series, scientific: key === 'lr',
    evidence: {
      measured: name + ' at logged pilot iterations.',
      result: key === 'miou4' ? `The selected rate finishes at ${round(pilotRuns.find(run => run.lr === selection.selected_lr)!.validation.at(-1)!.miou4)}.` : 'The rust line identifies the selected run.',
      meaning: split === 'validation' ? 'The same validation set was used for all three rates.' : 'The training log shows optimization behavior at matched iterations.',
      sourcePath: split === 'validation' ? chartSources.pilotValidation : chartSources.pilotTraining,
    },
  };
}

export function StatsTable({ headers, rows, highlight }: { headers: string[]; rows: (string | number)[][]; highlight?: number }) {
  return (
    <div className="table-scroll">
      <table className="research-table">
        <thead><tr>{headers.map(header => <th key={header} scope="col">{header}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => (
          <tr key={String(row[0])} className={highlight === index ? 'selected-row' : undefined}>
            {row.map((cell, i) => i === 0 ? <th key={i} scope="row">{cell}</th> : <td key={i}>{cell}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function SplitCharts({ chart }: { chart: 'shares' | 'seeds' }) {
  if (chart === 'shares') {
    return <ChartCard title="Labeled-pixel composition" type="bar" xKey="split" xLabel="Dataset split" barLabels={value => (value * 100).toFixed(1) + "%"} metrics={[{
      name: 'Class share', yLabel: 'Share of labeled pixels (0–1)', rows: splitRows, series: classSeries(''), domain: [0, 0.6],
      evidence: {
        measured: 'Labeled-pixel share for each terrain class and split.',
        result: 'The train and validation class mixes are close.',
        meaning: 'Seed 11 optimized that match. The expert test mixes differ.',
        sourcePath: 'data/dataset_v3_512/{train,val,test_msl,test_mer}.csv · sum each class_0–class_3 image pixel fraction, then divide by the sum across all four classes. Equal source image dimensions make this pixel-weighted.',
      },
    }]} />;
  }
  const bestSeed = seedSearch.reduce((best, row) => row.distance < best.distance ? row : best);
  return <ChartCard title="Saved seed comparison" type="bar" xKey="seed" xLabel="Candidate seed" highlightCategory={bestSeed.seed} metrics={[{
    name: 'L1', yLabel: 'Train–validation L1 (unitless)', rows: seedSearch,
    series: [{ key: 'distance', name: 'L1 difference', color: palette.grey }],
    evidence: {
      measured: 'Train–validation class-share L1 difference for each saved candidate row.',
      result: `Seed ${bestSeed.seed} had the lowest shown L1, ${bestSeed.distance}.`,
      meaning: 'Lower L1 indicates a closer class mix.',
      sourcePath: auditSource + ` · Seed IDs were saved for six candidates only; the notebook also printed an unlabeled worst value of ${auditSummary.worstL1}.`,
    },
  }]} />;
}

function Pilot() {
  const config = pilotProtocol.training_config;
  const ranked = [...pilotRuns].sort((a, b) => b.primary_score - a.primary_score);
  const [winner, runnerUp] = ranked;
  return (
    <>
      <ul className="points compact">
        <li>{pilotRuns.map(run => run.label).join(', ')} · {config.epochs_equiv} epochs and {comma(config.total_iters)} iterations each.</li>
        <li>Same initial weights, seed {config.seed} and sample order. All {comma(splitRows[1].images)} validation images at {config.eval_iters.map(comma).join(' / ')}.</li>
      </ul>
      <small className="source">{fromBackup('configs/lr_pilot_protocol.json')}</small>
      <ChartCard title="Validation during the pilot" xKey="iteration" xLabel="Iteration (steps)" xTicks={config.eval_iters} xFormat={comma} metrics={metrics.map(([key, name]) => pilotMetric(key, name, 'validation'))} />
      <ChartCard title="Training during the pilot" xKey="iteration" xLabel="Iteration (steps)" metrics={trainingMetrics.map(([key, name]) => pilotMetric(key, name, 'training'))} />
      <StatsTable headers={['Learning rate', ...config.eval_iters.map(step => 'mIoU4 @ ' + comma(step)), 'Selection mean', 'Mean validation loss']}
        rows={pilotRuns.map(run => [run.label + (run.lr === selection.selected_lr ? ' · selected' : ''),
          ...config.eval_iters.map(step => round(run.miou4[String(step) as keyof typeof run.miou4])),
          round(run.primary_score), round(run.mean_val_loss)])}
        highlight={pilotRuns.findIndex(run => run.lr === selection.selected_lr)} />
      <div className="stat-grid chart-stats">
        <StatCard label={'Selected · ' + winner.label} value={round(winner.primary_score)} badges={['validation']} />
        <StatCard label={'Runner-up · ' + runnerUp.label} value={round(runnerUp.primary_score)} badges={['validation']} />
        <StatCard label={'Gap · tie threshold ' + selection.tie_threshold} value={round(selection.top_gap)} />
      </div>
      <p className="footnote">Selection = mean validation mIoU4 at iterations {config.eval_iters.slice(-2).map(comma).join(' and ')}. Tie threshold {selection.tie_threshold}. Reject non-finite training loss or a late mIoU3 drop greater than {config.reject_miou3_drop}. {selection.excluded.length === 0 && 'No candidate was rejected.'}</p>
      <small className="source">{chartSources.selection}</small>
    </>
  );
}

function Setup() {
  const cfg = protocol;
  return (
    <>
      <StatsTable headers={['Setting', 'Purpose']} rows={[
        ['SegFormer MiT-B0 · ' + cfg.model, 'Common terrain evaluator'],
        [comma(splitRows[0].images) + ' train / ' + comma(splitRows[1].images) + ' validation', 'Fit the model and select the checkpoint'],
        [`${cfg.epochs} epochs · ${comma(cfg.steps_per_epoch)} steps/epoch · ${comma(cfg.total_iters)} scheduled`, 'Fixed training budget'],
        [`Batch ${cfg.batch_size} · seed ${cfg.seed}`, 'Batch size and reproducible initialization'],
        [`${cfg.optimizer} · weight decay ${cfg.weight_decay}`, 'Optimizer and regularization'],
        [`Peak ${cfg.start_lr.toExponential()} · ${cfg.warmup}-step warmup · cosine to ${(cfg.start_lr * cfg.final_frac).toExponential(0)}`, 'Pilot-selected rate and cosine decay'],
        [cfg.amp.toUpperCase() + ' AMP · Kaggle T4', 'Mixed precision on the recorded GPU'],
        ['Cross-entropy · ignore ' + cfg.ignore_index, 'Valid-pixel supervision'],
        [`Class weights: ${cfg.no_class_weights ? 'none' : 'enabled'} · gradient clipping: ${cfg.no_grad_clip ? 'none' : 'enabled'} · early stopping: ${cfg.early_stopping ? 'enabled' : 'none'}`, 'Complete the baseline protocol as planned'],
      ]} />
      <small className="source">{fromBackup('configs/baseline_protocol.json, code/mars_common.py')} · {roadmapSource}, pp. 7–8 (Kaggle T4 and loss)</small>
      <ChartCard title="Training schedule and stability" xKey="iteration" xLabel="Iteration (steps)" metrics={([
        ['lr', 'Learning rate', 'unitless'],
        ['grad_norm', 'Gradient norm', 'L2 norm'],
        ['skipped_steps_total', 'Skipped steps (cumulative)', 'count'],
      ] as const).map(([key, name, unit]) => ({
        name, yLabel: name + ' (' + unit + ')', rows: trainRows, series: [{ key, name, color: palette.rust }],
        scientific: key === 'lr', original: key === 'lr' ? original('learning_rate_vs_iteration') : undefined,
        evidence: {
          measured: name + ' at recorded training iterations.',
          result: 'First ' + trainRows[0][key] + ' → last ' + lastTrain[key] + '.',
          meaning: key === 'lr' ? 'The warmup is followed by cosine decay.' : 'The training log records optimization stability.',
          sourcePath: chartSources.training,
        },
      }))} />
      <p className="footnote">AMP recorded {lastTrain.nonfinite_grad_norm_total} non-finite gradient events and {lastTrain.skipped_steps_total} skipped optimizer steps. {comma(cfg.total_iters)} counts scheduled iterations.</p>
      <small className="source">{chartSources.training}</small>
    </>
  );
}

function Loss() {
  const minimum = { x: Number(bestLoss.epoch), y: Number(bestLoss.val_loss) };
  const metric: ChartMetric = {
    name: 'Full range', yLabel: 'Cross-entropy (unitless)', rows: lossRows, marked: [minimum],
    series: [
      { key: 'batch', name: 'Sampled training batch', color: palette.faint },
      { key: 'mean', name: 'Training epoch mean', color: palette.navy, dots: true },
      { key: 'validation', name: 'Validation loss', color: palette.rust, dots: true },
    ],
    original: original('combined_training_validation_loss'),
    evidence: {
      measured: `${comma(trainRows.length)} batch samples every ${protocol.train_log_every} iterations, plus recorded epoch means and validation loss.`,
      result: `Batch ${round(trainRows[0].loss)} → ${round(lastTrain.loss)}; epoch train ${round(valRows[0].epoch_mean_train_loss)} → ${round(lastVal.epoch_mean_train_loss)}; validation ${round(valRows[0].val_loss)} → ${round(lastVal.val_loss)}.`,
      meaning: 'Training averages batch losses. Validation weights by labeled pixels.',
      sourcePath: chartSources.training + ' · ' + chartSources.validation,
    },
  };
  const positiveMinimum = Math.min(...lossRows.flatMap(row => [row.batch, row.mean, row.validation]).filter((n): n is number => typeof n === 'number' && n > 0));
  return <ChartCard title="Sampled batch and epoch-level losses" xKey="epoch" xLabel="Epoch"
    xTicks={valRows.map(row => Number(row.epoch))} xFormat={value => String(Math.trunc(value))} metrics={[
      metric,
      { ...metric, name: 'Zoom (0–0.3)', domain: [0, 0.3], clip: true },
      { ...metric, name: 'Log scale', scale: 'log', domain: [positiveMinimum, 'auto'] },
    ]} />;
}

function Checkpoint() {
  return (
    <>
      <ChartCard title="Validation mIoU by epoch" xKey="epoch" xLabel="Epoch" metrics={[{
        name: 'Validation mIoU', yLabel: 'Mean IoU (0–1)', rows: valRows,
        series: [
          { key: 'miou4', name: 'mIoU4', color: palette.navy, dots: true },
          { key: 'miou3', name: 'mIoU3', color: palette.grey, dash: '6 3', dots: true },
        ],
        domain: [0.7, 0.96], clip: true, referenceX: freeze.selected_epoch,
        marked: [
          { x: freeze.selected_epoch, y: Number(selected.miou4) },
          { x: freeze.selected_epoch, y: Number(selected.miou3) },
          { x: Number(lastVal.epoch), y: Number(lastVal.miou4), small: true },
        ],
        original: original('miou3_miou4_vs_epoch'),
        evidence: {
          measured: 'mIoU4 and mIoU3 after each validation epoch.',
          result: `Epoch ${freeze.selected_epoch}: mIoU4 ${round(selected.miou4)}, mIoU3 ${round(selected.miou3)}.`,
          meaning: `Epoch ${bestLoss.epoch} had the lowest validation loss (${round(bestLoss.val_loss)}); mIoU4 determines selection.`,
          sourcePath: chartSources.validation,
        },
      }]} />
      <div className="stat-grid chart-stats">
        <StatCard label={'Best epoch · iteration ' + comma(freeze.selected_iteration)} value={String(freeze.selected_epoch)} badges={['validation']} />
        <StatCard label="Selected mIoU4" value={round(selected.miou4)} badges={['validation']} />
        <StatCard label="Selected loss" value={round(selected.val_loss)} badges={['validation']} />
        <StatCard label={`Epoch ${lastVal.epoch} mIoU4`} value={round(lastVal.miou4)} badges={['validation']} />
      </div>
      <p className="footnote">Highest validation mIoU4. Ties go to lower validation loss, then the earlier epoch.</p>
      <small className="source">{fromBackup('checkpoints/baseline/baseline_frozen.json')} · {chartSources.validation}</small>
      <details className="research-details"><summary>Full {valRows.length}-epoch table</summary>
        <StatsTable headers={['Epoch', 'mIoU4', 'mIoU3', 'Validation loss']}
          rows={valRows.map(row => [Number(row.epoch), round(row.miou4), round(row.miou3), round(row.val_loss)])}
          highlight={valRows.indexOf(selected)} />
        <small className="source">{chartSources.validation}</small>
      </details>
    </>
  );
}

function PerClass() {
  return (
    <>
      <ChartCard title="Validation metrics by terrain class" xKey="epoch" xLabel="Epoch"
        metrics={([['iou', 'IoU'], ['precision', 'Precision'], ['recall', 'Recall']] as const).map(([key, name]) => ({
          name, yLabel: name + ' (0–1)', rows: valRows, series: classSeries(key + '_'), domain: [0, 1],
          original: original('per_class_' + key + '_vs_epoch'),
          evidence: {
            measured: `Per-class validation ${name} at every epoch.`,
            result: key === 'iou'
              ? `Big Rock starts at ${round(valRows[0].iou_bigrock)} and peaks at ${round(bestRock.iou_bigrock)} (epoch ${bestRock.epoch}). Epoch ${lastVal.epoch}: Soil ${round(lastVal.iou_soil)}, Bedrock ${round(lastVal.iou_bedrock)}, Sand ${round(lastVal.iou_sand)}.`
              : `Big Rock changes from ${round(valRows[0][key + '_bigrock'])} to ${round(lastVal[key + '_bigrock'])}.`,
            meaning: 'Big Rock is the unstable minority class.',
            sourcePath: chartSources.validation,
          },
        }))} />
      <ConfusionHeatmap title={`Epoch ${confusion.epoch} validation confusion matrix`} matrix={confusion.confusion_matrix} sourcePath={chartSources.confusion} original={original("confusion_epoch_16")} />
    </>
  );
}

function Recovery() {
  const midpoint = protocol.epochs / 2;
  return (
    <>
      <ul className="points compact">
        <li>Resume state: model, optimizer, LR scheduler, AMP scaler, random state, data position and iteration count. The LR schedule continued.</li>
        <li>Kaggle sessions are temporary. The saved state made the run reproducible.</li>
      </ul>
      <div className="flow-band diagram-scroll">
        <PipelineDiagram nodes={[
          { lines: ['Stage 1', `Epochs 1–${midpoint}`], note: `To step ${comma(protocol.steps_per_epoch * midpoint)}` },
          { lines: ['State-complete', 'checkpoint'] },
          { lines: ['Stage 2', `Epochs ${midpoint + 1}–${protocol.epochs}`], note: `To step ${comma(protocol.total_iters)}` },
          { lines: ['Pick best', 'by validation'] },
          { lines: ['Freeze', `epoch ${freeze.selected_epoch}`], accent: true },
        ]} gap={34} />
      </div>
      <small className="source">{roadmapSource}, p. 8 · {fromBackup('configs/baseline_protocol.json, checkpoints/baseline/baseline_frozen.json')}</small>
    </>
  );
}

function Tracking() {
  const live = 'https://wandb.ai/hudafatimah-04-rv-college-of-engineering/';
  return (
    <>
      <div className="copy-grid">
        <div className="copy-card"><h3>Final training</h3><p>mars-terrain-segmentation · segformer-b0-seed42</p><p>Run ID {tracking.run_id}</p>
          <a href={live + 'mars-terrain-segmentation/runs/' + tracking.run_id}>Open W&B run</a></div>
        <div className="copy-card"><h3>Learning-rate pilots</h3><p>mars-compression</p><a href={live + 'mars-compression'}>Open W&B project</a></div>
      </div>
      <p className="footnote">W&amp;B shows the curves. Local CSV/JSON is the authoritative record.</p>
      <p className="footnote">Progress output approached 5e-6 while the W&amp;B summary showed about 1e-5. The cause was not verified.</p>
      <small className="source">{roadmapSource}, p. 9 · {fromBackup('results/baseline/wandb_run.json')}</small>
      {wandbExports.length > 0 && <div className="figure-grid chart-stats">
        {wandbExports.map(({ filename, url }) => <FigureCard key={url} src={url} alt={filename}
          measured="Experiment tracking output." result={filename} meaning="The export records the tracked experiment."
          sourcePath={'W&B export: ' + filename} />)}
      </div>}
    </>
  );
}

export type TrainingTopic = 'pilot' | 'setup' | 'loss' | 'checkpoint' | 'classes' | 'recovery' | 'tracking';

const topics = {
  pilot: Pilot, setup: Setup, loss: Loss, checkpoint: Checkpoint, classes: PerClass, recovery: Recovery, tracking: Tracking,
};

export function TrainingBlock({ topic }: { topic: TrainingTopic }) {
  const Topic = topics[topic];
  return <Topic />;
}
