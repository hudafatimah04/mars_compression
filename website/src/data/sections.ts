import type { BaselineTopic } from '../components/BaselineBlocks';
import type { TrainingTopic } from '../components/TrainingBlocks';

export type PipelineNode = {
  lines: readonly string[];
  note?: string;
  accent?: boolean;
};

export type Evidence = { measured: string; result: string; meaning: string; sourcePath: string };
export type Figure = Evidence & { src: string; alt: string };
export type Stat = {
  value: string;
  label: string;
  detail?: string;
  badges?: readonly ('validation' | 'test' | 'crowdsourced' | 'expert' | 'diagnostic')[];
  sourcePath?: string;
};

export type BlockData = { title: string } & (
  | { kind: 'problem'; points: readonly string[]; flow: readonly PipelineNode[]; question: string }
  | { kind: 'comparison'; methods: readonly { id: string; flow: readonly PipelineNode[] }[];
      questions: readonly { id: string; label: string; detail: string }[]; footnote: string; points: readonly string[] }
  | { kind: 'gallery'; legend: readonly { label: string; color: string }[]; figures: readonly Figure[]; stats: readonly Stat[]; note: string; citation: string }
  | { kind: 'preprocessing'; notes: readonly string[]; caution: string; citation: string; benchmark: Evidence; figure: Figure }
  | { kind: 'stats'; stats: readonly Stat[]; evidence?: Evidence; figure?: Figure; points?: readonly string[]; note?: string; citation?: string }
  | { kind: 'copy'; columns?: readonly { title: string; text: string }[]; points?: readonly string[]; line?: string; sourcePath?: string }
  | { kind: 'stepper'; steps: readonly { name: string; reason: string }[]; note: string; sourcePath: string }
  | { kind: 'segmentation-example'; line: string; figure: Figure }
  | { kind: 'architecture'; evidence: Evidence }
  | { kind: 'interface'; flow: readonly PipelineNode[]; notes: readonly string[]; evidence: Evidence }
  | { kind: 'split-chart'; chart: 'shares' | 'seeds' }
  | { kind: 'training'; topic: TrainingTopic }
  | { kind: 'baseline'; topic: BaselineTopic }
  | { kind: 'placeholder' }
);

export type Section = { id: number; title: string; takeaway: string; blocks: readonly BlockData[] };

const audit = 'notebooks/Mars_Compression_01_Data_Audit_and_Baseline (1).ipynb';
const cell = (number: number) => `${audit} · cell ${number}`;
const segNotebook = 'notebooks/Mars_Compression_01_SegFormer_Baseline (1).ipynb';
const roadmap = 'documentation/Mars_Terrain_Research_Technical_Roadmap_Evaluator.pdf';
const baseline = 'backups/backup_baseline_final_evaluated.zip';
const assets = `${import.meta.env.BASE_URL}assets/section2/`;
const decodedImage = { lines: ['Decoded', 'image'] };
const frozenSegFormer = { lines: ['Frozen', 'SegFormer'], accent: true };

export const terrainLegend = [
  { label: '0 Soil', color: '#a5804c' }, { label: '1 Bedrock', color: '#d82626' },
  { label: '2 Sand', color: '#f2d833' }, { label: '3 Big rock', color: '#3366f2' },
  { label: '255 Ignore', color: '#000000' },
] as const;

export const sections: readonly Section[] = [
  {
    id: 1, title: 'Research problem and dataset', takeaway: 'Mars images must be compressed. We test whether the decoded image still supports terrain segmentation.',
    blocks: [
      {
        kind: 'problem', title: 'The issue',
        points: [
          'Mars-to-Earth bandwidth is limited.',
          'NASA/JPL’s ICER supports progressive reconstruction with wavelets.',
          'JPEG2000 is our conventional wavelet baseline, a proxy for mission-specific rover codecs.',
        ],
        flow: [
          { lines: ['Mars image'] }, { lines: ['Encode'] },
          { lines: ['Transmit'], note: 'limited bits', accent: true }, { lines: ['Decode'] },
          { lines: ['Terrain', 'segmentation'] },
        ],
        question: 'Does the decoded image still support terrain segmentation?',
      },
      {
        kind: 'copy', title: 'What NASA does today: ICER',
        columns: [
          { title: 'NASA/JPL ICER', text: 'Wavelet-based image codec used in Mars exploration. Supports progressive reconstruction (the image sharpens as more data arrives).' },
          { title: 'Our baseline: JPEG2000', text: 'Public, reproducible wavelet codec. A proxy for conventional coding, not a replica of ICER flight software.' },
        ],
        line: 'Conventional codecs optimize image reconstruction, not a downstream task such as terrain segmentation.',
        sourcePath: roadmap,
      },
      {
        kind: 'comparison', title: 'What we study',
        points: [
          'At the same actual bits per pixel, does task-aware compression preserve terrain segmentation better than conventional compression, and what does it cost in image quality?',
          'We do not assume it will. All three methods reconstruct a viewable image (not mask-only).',
        ],
        methods: [
          { id: 'M1', flow: [{ lines: ['JPEG2000'], note: 'Conventional' }, decodedImage, frozenSegFormer] },
          { id: 'M2', flow: [{ lines: ['CompressAI'], note: 'Reconstruction-only' }, decodedImage, frozenSegFormer] },
          { id: 'M3', flow: [{ lines: ['CompressAI', 'Task-aware'], note: 'Adds segmentation loss' }, decodedImage, frozenSegFormer] },
        ],
        questions: [
          { id: 'RQ1', label: 'Image quality at the same bitrate', detail: 'PSNR · MS-SSIM' },
          { id: 'RQ2', label: 'Segmentation at the same bitrate', detail: 'mIoU4 · mIoU3 · per-class IoU' },
        ],
        footnote: 'Compared at matched actual bits per pixel (bpp).',
      },
      {
        kind: 'copy', title: 'The dataset: AI4Mars',
        columns: [
          { title: 'Source', text: 'NASA JPL and Zooniverse crowd labeling, plus expert labels from NASA JPL. Merged release v0.6 from Zenodo (record 15995036), about 15.12 GiB.' },
          { title: 'Why we use it', text: 'Real rover images with pixel-level terrain labels. One fixed task definition, crowd labels for training and expert labels for testing.' },
          { title: 'Features', text: 'Originals about 1024×1024. Terrain (NAV) labels. Pixels beyond 30 m and the rover itself are masked. Training labels merge at least 3 labelers with 2/3 pixel agreement. Expert test labels use 100% agreement.' },
        ],
        sourcePath: 'AI4Mars merged v0.6 (Zenodo record 15995036) · ' + roadmap + ', p. 3',
      },
      {
        kind: 'gallery', title: 'Terrain classes',
        legend: terrainLegend,
        stats: [
          { value: '36.3%', label: 'Soil' }, { value: '51.8%', label: 'Bedrock' },
          { value: '11.0%', label: 'Sand' }, { value: '0.8%', label: 'Big rock' },
        ],
        note: 'Big rock is rare, so accuracy alone hides it. We report per-class IoU.',
        citation: roadmap + ' · ' + cell(36) + ' · ' + baseline + ' → code/mars_common.py',
        figures: [
          {
            src: assets + 'audit-cell-16.png', alt: 'Grayscale views, masks and overlays from train, validation, MSL test and MER test.',
            measured: 'Image–mask alignment across splits.',
            result: 'Sampled pairs show soil, bedrock and black unlabeled regions.',
            meaning: 'The overlays show where terrain labels cover each scene.',
            sourcePath: cell(16),
          },
          {
            src: assets + 'audit-cell-18.png', alt: 'Highly labeled soil, bedrock, sand and soil examples with masks and overlays.',
            measured: 'Scenes with the highest labeled coverage in each split.',
            result: 'These masks are dominated by soil, bedrock or sand.',
            meaning: 'The panels show how terrain annotations look in well-labeled scenes.',
            sourcePath: cell(18),
          },
          {
            src: assets + 'audit-cell-19.png', alt: 'Selected Big Rock and mixed terrain scenes with blue rock annotations in the first two rows.',
            measured: 'Big Rock examples and its share of labeled training pixels.',
            result: 'Big Rock is blue and represents about 0.8% of labeled training pixels.',
            meaning: 'The selected frames make the rare class visible.',
            sourcePath: `${audit} · cell 19 (figure), cell 36 (pixel share)`,
          },
        ],
      },
    ],
  },
  {
    id: 2, title: 'Splitting and preprocessing', takeaway: 'A frozen, leakage-checked 512×512 grayscale benchmark.',
    blocks: [

      {
        kind: 'stats', title: 'Step 1: split into train, validation and test',
        points: [
          'Train and validation: Curiosity, crowdsourced labels. Test: expert labels on Curiosity and on Spirit/Opportunity.',
          'Why: prevent leakage and support fair model selection with separate test data.',
        ],
        stats: [
          { value: '9,803', label: 'Train', detail: 'Curiosity · Model fitting', badges: ['crowdsourced'] },
          { value: '1,192', label: 'Validation', detail: 'Curiosity · Selection and codec calibration', badges: ['crowdsourced', 'validation'] },
          { value: '311', label: 'Test MSL', detail: 'Curiosity', badges: ['expert', 'test'] },
          { value: '195', label: 'Test MER', detail: 'Spirit / Opportunity', badges: ['expert', 'test'] },
          { value: '11,501', label: 'Total' },
        ],
        citation: 'splits/split_v3_FROZEN.json · ' + roadmap,
      },
      {
        kind: 'stats', title: 'Step 2: split by Martian time, not randomly',
        points: [
          'Frames taken close in time look alike, so a random split leaks. We split by MSL spacecraft clock (SCLK) time and excluded frames around the held-out data.',
          'Split seed 11 was the best tested candidate by a predeclared class-balance rule (L1 difference 0.032). Frozen as split_v3_FROZEN.json.',
        ],
        stats: [
          { value: '3.01', label: 'Sols · train–validation' },
          { value: '3.00', label: 'Sols · train–MSL test' },
          { value: '3.83', label: 'Sols · validation–MSL test' },
        ],
        note: 'Split seed 11 is not the training seed 42.',
        citation: cell(34) + ' · splits/split_v3_FROZEN.json · ' + baseline + ' → configs/baseline_protocol.json',
      },
      { kind: 'split-chart', title: 'Class share per split', chart: 'shares' },
      { kind: 'split-chart', title: 'Why seed 11', chart: 'seeds' },
      {
        kind: 'preprocessing', title: 'Step 3: resize to 512×512',
        notes: [
          '1,048,576 → 262,144 pixels (one quarter): less compute, one consistent size.',
          'Images use bilinear interpolation; masks use nearest-neighbour so class IDs are never blended.',
        ],
        caution: 'Resizing is not lossless: tiny Big rock regions can vanish (train images with Big rock 1,379 → 1,359; validation 184 → 183).',
        citation: roadmap + ' · ' + cell(34) + ' and cell 36 · data/dataset_v3_512/preprocessing.json',
        benchmark: {
          measured: 'Throughput on a T4 at the same reported peak memory.',
          result: '512², batch 16: 0.015 s/image. 1024², batch 4: 0.075 s/image. Both: 4.38 GB.',
          meaning: 'Smaller inputs processed faster in this benchmark.',
          sourcePath: cell(21),
        },
        figure: {
          src: assets + 'step2_alignment_check.png', alt: 'Prepared grayscale images, terrain masks and overlays in three columns.',
          measured: 'Alignment of prepared images and masks.',
          result: 'The panels show grayscale images, masks and overlays at 512×512.',
          meaning: 'Overlay inspection checks that labels follow the prepared image.',
          sourcePath: 'figures/step2_alignment_check.png · data/dataset_v3_512/preprocessing.json',
        },
      },
      {
        kind: 'stepper', title: 'Step 4: the preprocessing pipeline',
        steps: [
          { name: 'Pair images and masks', reason: 'Prevents the wrong mask from supervising an image.' },
          { name: 'Check content', reason: 'Check ~1024×1024 inputs and labels 0, 1, 2, 3, 255.' },
          { name: 'Convert to grayscale', reason: 'Use one consistent intensity channel for every image.' },
          { name: 'Resize image to 512×512 (bilinear)', reason: 'Reduce compute with one consistent image size.' },
          { name: 'Resize mask to 512×512 (nearest)', reason: 'Keep integer class IDs intact during resizing.' },
          { name: 'Save as lossless PNG', reason: 'Adds no extra lossy compression before our study.' },
          { name: 'Write split CSVs and preprocessing.json', reason: 'Record split membership and preprocessing for reproducibility.' },
          { name: 'Model input: repeat to 3 channels, normalize', reason: 'Match pretrained SegFormer input (mean 0.449, std 0.226).' },
          { name: 'Training only: flip image and mask together', reason: 'Horizontal flips add variety while keeping labels aligned.' },
        ],
        note: 'Repeating to 3 channels is only a SegFormer input step. The codecs use the single grayscale channel (policy pending joint approval).',
        sourcePath: roadmap + ' · data/dataset_v3_512/preprocessing.json · ' + baseline + ' → code/mars_common.py, code/mars_det.py · bit rate feasibility test/grayscale_policy_PROPOSED.json',
      },
      {
        kind: 'stats', title: 'Integrity checks',
        stats: [
          { value: '4', label: 'Dataset ZIPs verified by MD5', sourcePath: roadmap },
          { value: '23,008', label: 'Files staged · 0 SHA256 mismatches', detail: '11,501 pairs = 23,002 image/mask files, plus CSVs and metadata.', sourcePath: roadmap },
          { value: '4 / 4', label: 'Canonical split hashes passed', detail: 'Checked on original columns, excluding img_512 and mask_512.', sourcePath: baseline + ' → logs/frozen_split_verification.json' },
          { value: '0', label: 'Invalid label pixels after resizing', sourcePath: cell(36) },
          { value: '0', label: 'Filenames shared across splits', sourcePath: 'notebooks/mars-compression-02-lr-pilot.ipynb · cell 10' },
          { value: '0', label: 'MSL image-key collisions', sourcePath: cell(9) },
          { value: '16,064', label: 'MSL crowd labels matched before filtering', sourcePath: cell(9) },
          { value: '204 / 204', label: 'MER test images with matching CRCs in the MER pool', sourcePath: cell(9) },
        ],
        evidence: {
          measured: 'Label validity, filename overlap and image–mask matching.',
          result: 'The CRC audit flagged every source MER test image in the MER pool.',
          meaning: 'The frozen split keeps MER pool copies out of training and validation.',
          sourcePath: `${audit} · cells 9, 34, 36 · notebooks/mars-compression-02-lr-pilot.ipynb · cell 10`,
        },
        figure: {
          src: assets + 'split_check_pairs.png', alt: 'Archived image, annotated mask and overlay examples across splits.',
          measured: 'Image–mask pairing in the archived audit.',
          result: 'Sample overlays show terrain labels on their paired source images.',
          meaning: 'A visual spot check complements the filename audit.',
          sourcePath: 'backups/backup_02_splits_and_visual_checks.zip → figures/split_check_pairs.png',
        },
      },
      { kind: 'copy', title: 'Note on labels', line: 'Train/validation labels are crowdsourced; test labels are expert. A drop from validation to test is not, on its own, proof of overfitting or domain shift.', sourcePath: roadmap },
    ],
  },
  {
    id: 3, title: 'Feature pyramid and SegFormer', takeaway: 'One frozen, lightweight four-class evaluator for every codec.',
    blocks: [
      {
        kind: 'segmentation-example', title: 'What is semantic segmentation?',
        line: 'Every pixel gets a terrain label: soil, bedrock, sand or big rock. Label 255 is ignored.',
        figure: {
          src: `${import.meta.env.BASE_URL}assets/section3/ground-truth-pair.png`,
          alt: 'Grayscale rocky terrain followed by its hand-labeled mask in blue, red, yellow and black.',
          measured: 'Pixel-level terrain labels.',
          result: 'Rover image and its ground-truth mask.',
          meaning: 'The mask identifies the annotated terrain at each pixel.',
          sourcePath: cell(19) + ' · first row, image and mask crop',
        },
      },
      {
        kind: 'stats', title: 'Why SegFormer MiT-B0?',
        points: ['It is the evaluator, not the research contribution. One fixed model keeps codec comparisons fair.'],
        stats: [
          { value: '3.715M', label: 'Parameters', sourcePath: 'results/baseline/step3_sanity.json' },
          { value: 'nvidia/mit-b0', label: 'Pretrained encoder', sourcePath: 'results/baseline/step3_sanity.json' },
          { value: '4', label: 'Terrain classes', sourcePath: roadmap + ', p. 6' },
        ],
      },
      {
        kind: 'architecture', title: 'Feature pyramid: four scales',
        evidence: {
          measured: 'Encoder resolutions and checkpoint tensor widths.',
          result: 'Four scales feed a decoder with a common width of 256 channels.',
          meaning: 'Fine detail and context both feed the decision, so compression that hurts either can hurt segmentation.',
          sourcePath: baseline + ' → checkpoints/baseline/frozen_best_epoch16.pt, code/mars_common.py · nvidia/mit-b0 config.json',
        },
      },
      {
        kind: 'copy', title: 'Adapting the pretrained model',
        line: 'ImageNet-pretrained nvidia/mit-b0 encoder, new four-class head, and fine-tuning on Curiosity training data.',
        points: ['Loading warnings about the 1,000-class mapping and newly initialized head weights are expected.'],
        sourcePath: roadmap + ', p. 6 · ' + segNotebook + ' · cell 6',
      },
      {
        kind: 'interface', title: 'Input and output interface',
        flow: [
          { lines: ['512×512', 'grayscale PNG'] },
          { lines: ['Scale to', '[0,1]'] },
          { lines: ['Repeat to', '3 channels'] },
          { lines: ['Normalise'], note: '0.449 / 0.226' },
          { lines: ['SegFormer'], accent: true },
          { lines: ['4-class', 'logits'] },
          { lines: ['Bilinear', 'upsample'] },
          { lines: ['Argmax'] },
          { lines: ['512×512', 'labels'] },
        ],
        notes: [
          'Training uses cross-entropy on valid pixels. Label 255 is excluded from loss and the evaluation confusion matrix.',
          'Repeating to 3 channels is only a model-input step.',
        ],
        evidence: {
          measured: 'Model input, logits and pixel labels.',
          result: 'Mean 0.449 and standard deviation 0.226. Bilinear upsampling restores the 512×512 grid.',
          meaning: 'The frozen model uses the same interface for every codec.',
          sourcePath: baseline + ' → code/mars_common.py · ' + roadmap + ', p. 6',
        },
      },
      {
        kind: 'stats', title: 'Pipeline checks before training',
        stats: [
          { value: '1.383220', label: 'Initial loss (ln 4 ≈ 1.386)', badges: ['diagnostic'], sourcePath: 'results/baseline/step3_sanity.json · ' + segNotebook + ' · cell 6' },
          { value: 'Passed', label: 'Alignment, gradient flow and memory', badges: ['diagnostic'], sourcePath: segNotebook + ' · cells 5–6' },
          { value: '0.723899', label: 'First memorization mIoU4 · failed', badges: ['diagnostic'], sourcePath: 'results/baseline/step3_sanity.json' },
          { value: '0.815496', label: 'Longer recheck mIoU4 · passed', detail: 'Loss 0.038359', badges: ['diagnostic'], sourcePath: 'results/baseline/step3_overfit_recheck.json' },
        ],
        evidence: {
          measured: 'Initial loss, alignment, gradients, memory and memorization.',
          result: 'The longer memorization recheck passed.',
          meaning: 'The pipeline was verified before the official run.',
          sourcePath: 'results/baseline/step3_sanity.json · results/baseline/step3_overfit_recheck.json · ' + segNotebook,
        },
      },
      {
        kind: 'copy', title: 'Why the evaluator is frozen',
        points: [
          'Same weights, evaluation mode and preprocessing for every codec.',
          'Otherwise a gain could come from a better classifier, not from information preserved in the bitstream.',
        ],
        line: 'Training and checkpoint selection are in Section 4; the frozen results are in Section 5.',
        sourcePath: roadmap + ', p. 14 (Q5)',
      },
    ],
  },
  {
    id: 4, title: 'Learning-rate experiments and model training',
    takeaway: 'LR 1e-4 was chosen by a controlled pilot; epoch 16 by validation mIoU4, before any test data was used.',
    blocks: [
      { kind: 'training', title: 'Learning-rate pilot: three candidates', topic: 'pilot' },
      { kind: 'training', title: 'Full training setup', topic: 'setup' },
      { kind: 'training', title: 'Training and validation loss', topic: 'loss' },
      { kind: 'training', title: 'Validation mIoU and checkpoint selection', topic: 'checkpoint' },
      { kind: 'training', title: 'Per-class performance during training', topic: 'classes' },
      { kind: 'training', title: 'Two-stage training and safe recovery', topic: 'recovery' },
      { kind: 'training', title: 'Experiment tracking', topic: 'tracking' },
    ],
  },
  {
    id: 5, title: 'Frozen baseline evaluation',
    takeaway: 'One frozen epoch-16 model is the uncompressed reference. Validation and expert-test results are kept separate.',
    blocks: [
      { kind: 'baseline', title: 'The frozen checkpoint', topic: 'frozen' },
      { kind: 'baseline', title: 'Validation vs expert test', topic: 'scores' },
      { kind: 'baseline', title: 'Per-class results', topic: 'classes' },
      { kind: 'baseline', title: 'Confusion matrices', topic: 'matrices' },
      { kind: 'baseline', title: 'Big Rock across splits', topic: 'rocks' },
      { kind: 'baseline', title: 'What the frozen model predicts', topic: 'predictions' },
      { kind: 'baseline', title: 'The uncompressed reference', topic: 'reference' },
    ],
  },
  ...[
    [6, 'Compression methodology and feasibility', 'Codec settings and measured bitrate.'],
    [7, 'Final comparison and conclusions', 'Image quality and segmentation at matched bitrate.'],
  ].map(([id, title, takeaway]) => ({
    id: Number(id), title: String(title), takeaway: String(takeaway),
    blocks: [{ kind: 'placeholder', title: 'In progress' }] as const,
  })),
];
