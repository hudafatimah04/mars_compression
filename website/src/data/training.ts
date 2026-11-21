import validationCsv from '../../data/source/results/baseline/validation_log.csv?raw';
import trainingCsv from '../../data/source/results/baseline/train_log.csv?raw';
import trainSplitCsv from '../../data/source/dataset_v3_512/train.csv?raw';
import valSplitCsv from '../../data/source/dataset_v3_512/val.csv?raw';
import mslSplitCsv from '../../data/source/dataset_v3_512/test_msl.csv?raw';
import merSplitCsv from '../../data/source/dataset_v3_512/test_mer.csv?raw';
import seedSearch from '../../data/source/seed_search_cell_34.json';
import selection from '../../data/source/results/lr_pilot/lr_selection.json';
import protocol from '../../data/source/configs/baseline_protocol.json';
import pilotProtocol from '../../data/source/configs/lr_pilot_protocol.json';
import freeze from '../../data/source/checkpoints/baseline/baseline_frozen.json';
import confusion from '../../data/source/results/baseline/confusion_matrices/epoch_16.json';
import tracking from '../../data/source/results/baseline/wandb_run.json';

export { selection, protocol, pilotProtocol, freeze, confusion, tracking, seedSearch };

export type ChartRow = Record<string, number | string | null>;

const archive = 'backups/backup_baseline_final_evaluated.zip';
export const fromBackup = (path: string) => archive + ' → ' + path;
export const roadmapSource = 'documentation/Mars_Terrain_Research_Technical_Roadmap_Evaluator.pdf';
export const auditSource = 'notebooks/Mars_Compression_01_Data_Audit_and_Baseline (1).ipynb · cell 34';
export const chartSources = {
  training: fromBackup('results/baseline/train_log.csv'),
  validation: fromBackup('results/baseline/validation_log.csv'),
  pilotValidation: fromBackup('logs/lr_pilot/{lr3e-05,lr1e-04,lr3e-04}_val.csv'),
  pilotTraining: fromBackup('logs/lr_pilot/{lr3e-05,lr1e-04,lr3e-04}_train.csv'),
  confusion: fromBackup('results/baseline/confusion_matrices/epoch_16.json'),
  selection: fromBackup('results/lr_pilot/lr_selection.json'),
};

export const classNames = ['Soil', 'Bedrock', 'Sand', 'Big Rock'] as const;
export const classKeys = ['soil', 'bedrock', 'sand', 'bigrock'] as const;
const csvFields = (line: string) => line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);

function csvNumbers(csv: string, fields: readonly string[]) {
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  const columns = csvFields(header);
  const indices = fields.map(field => columns.indexOf(field));
  if (indices.includes(-1)) throw new Error('Missing numeric CSV column: ' + fields.filter((_, i) => indices[i] === -1).join(', '));
  return lines.map(line => {
    const row = csvFields(line);
    return Object.fromEntries(fields.map((field, i) => {
      const raw = row[indices[i]];
      const number = Number(raw);
      return [field, raw?.trim() && Number.isFinite(number) ? number : null];
    }));
  });
}

const classMetrics = ['iou', 'precision', 'recall'] as const;
export const trainRows = csvNumbers(trainingCsv, ['iteration', 'epoch', 'loss', 'lr', 'grad_norm', 'skipped_steps_total', 'nonfinite_grad_norm_total']);
export const valRows = csvNumbers(validationCsv, [
  'iteration', 'epoch', 'val_loss', 'miou4', 'miou3', 'pixacc', 'epoch_mean_train_loss',
  ...classMetrics.flatMap(metric => classKeys.map(key => metric + '_' + key)),
]);

const pilotFiles = import.meta.glob('../../data/source/logs/lr_pilot/*.csv', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
export const pilotRuns = selection.candidates.map(candidate => ({
  ...candidate,
  label: candidate.lr.toExponential(),
  validation: csvNumbers(pilotFiles[`../../data/source/logs/lr_pilot/${candidate.tag}_val.csv`], ['iteration', 'miou4', 'miou3', 'val_loss']),
  training: csvNumbers(pilotFiles[`../../data/source/logs/lr_pilot/${candidate.tag}_train.csv`], ['iteration', 'loss', 'lr', 'grad_norm', 'skipped_steps_total']),
}));

export const selected = valRows.find(row => row.epoch === freeze.selected_epoch)!;
export const lastVal = valRows.at(-1)!;
export const bestLoss = valRows.reduce((best, row) => Number(row.val_loss) < Number(best.val_loss) ? row : best);
export const bestRock = valRows.reduce((best, row) => Number(row.iou_bigrock) > Number(best.iou_bigrock) ? row : best);
export const lastTrain = trainRows.at(-1)!;
export const round = (value: number | null, decimals = 6) => value === null ? '—' : value.toFixed(decimals);
export const comma = (value: number) => value.toLocaleString('en-US');

const splitFields = ['class_0', 'class_1', 'class_2', 'class_3'];
const splitSources = [
  ['Train', trainSplitCsv], ['Validation', valSplitCsv], ['Test MSL', mslSplitCsv], ['Test MER', merSplitCsv],
] as const;
export const splitRows = splitSources.map(([split, csv]) => {
  const rows = csvNumbers(csv, splitFields);
  const totals = splitFields.map(key => rows.reduce((total, row) => total + Number(row[key]), 0));
  const labelled = totals.reduce((sum, value) => sum + value, 0);
  return { split, images: rows.length, ...Object.fromEntries(classKeys.map((key, index) => [key, totals[index] / labelled])) };
});

export const lossRows: ChartRow[] = trainRows.map(sample => {
  const epoch = valRows.find(row => row.iteration === sample.iteration);
  return {
    epoch: sample.epoch, batch: sample.loss,
    mean: epoch?.epoch_mean_train_loss ?? null,
    validation: epoch?.val_loss ?? null,
  };
});

export const original = (name: string) => `${import.meta.env.BASE_URL}assets/section4/${name}.png`;
export const wandbExports = Object.entries(import.meta.glob('../../data/wandb/{final,lr_pilot}/*.{png,jpg,jpeg,svg,webp}', {
  eager: true, query: '?url', import: 'default',
})).map(([path, url]) => ({ filename: path.split('/').at(-1)!, url: String(url) }));
