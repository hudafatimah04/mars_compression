[README (1).md](https://github.com/user-attachments/files/34762391/README.1.md)
# Mars Terrain Compression — Research Project

**Goal:** Compare **JPEG2000**, **CompressAI reconstruction-only**, and **CompressAI task-aware** image compression for (1) Mars image reconstruction quality and (2) four-class terrain segmentation at **matched actual bits per pixel (bpp)**. Cross-rover compression experiments are **optional later work**.

**Status:** Dataset preprocessing, SegFormer training, checkpoint freezing, and uncompressed baseline testing are complete. **Compression experiments are not yet complete.**

## Where everything is stored

**GitHub (this private repository):** `https://github.com/hudafatimah04/mars_compression`

- `README.md` — this setup guide.
- `Mars_Terrain_Compression_PRD_v1_0.pdf` — project requirements and literature review.
- `Mars_Compression_Teammate_Handover_*.md` — teammate's implementation handover.
- `Mars_Terrain_Research_Technical_Roadmap_*.pdf` — completed-work explanation for evaluators.
- `shared_compression_protocol_PROPOSED.json` — **proposed, not yet approved** shared bitrate/metric settings.
- `baseline_final_eval_cell.py` — recorded one-time baseline evaluation code; **do not rerun the completed test**.
- `notebooks/` — four notebooks in development order: **data audit/preprocessing**, **initial SegFormer checks**, **learning-rate pilot**, **final 20-epoch SegFormer training/freezing/evaluation**. These are historical records, not a single run-all workflow.
- `results/baseline/` — add the small `final_test_results.json` from the complete backup here for convenient reference.

**Kaggle dataset:** `mars-terrain-v3-512` (owner: `hudafatimah`). Request access if private; in your Kaggle notebook, use **Add Input** to attach it. The mounted location can differ by notebook; inspect `/kaggle/input/` rather than assuming an absolute path.

| Kaggle asset | Contents / use |
|---|---|
| `dataset_v3_512_train_part1.zip`, `part2.zip`, `part3.zip` | Prepared 512×512 grayscale training images and segmentation masks (9,803 image/mask pairs in total). |
| `dataset_v3_512_val_test_csv.zip` | Validation (1,192), MSL test (311), MER test (195), corresponding masks, CSVs and preprocessing metadata. |
| `split_v3_FROZEN.json` | Frozen split definition; **do not regenerate or change**. |
| `mars_segformer_trained_model.zip` | **Small model-sharing package**: frozen epoch-16 SegFormer, metadata, baseline config and core Python code. |
| `backup_baseline_final_evaluated.zip` | **Full project recovery archive**: checkpoints, source modules, config, frozen split, training/validation logs, confusion matrices, training plots, and final baseline test results. Not needed for routine inference. |

Kaggle's Data Explorer may display ZIP contents as folders. Either way, the original archive names identify the assets.

## Which SegFormer ZIP should I use?

### `mars_segformer_trained_model.zip` — use this for compression experiments

Contains these **nine verified paths**:

```text
checkpoints/baseline/frozen_best_epoch16.pt
checkpoints/baseline/baseline_frozen.json
configs/baseline_protocol.json
code/mars_common.py
code/ckpt_utils.py
code/mars_det.py
code/tracking.py
code/recovery.py
code/baseline_train.py
```

The frozen checkpoint is the **same** for JPEG2000 and both CompressAI methods. Do not retrain or replace it. The core loader and metrics are in `code/mars_common.py` (`MarsSeg`, `SegWrap`, `evaluate`). It expects a one-channel grayscale tensor, repeats/normalises it internally, and produces four-class segmentation logits.

**Model verification:** epoch **16**, iteration **19,600**, validation mIoU4 **0.838503**. Checkpoint SHA256:

`afb9b155e07c617ab69cfa29455beda9318605b0afcec81e07f558a48bcbbda6`

### `backup_baseline_final_evaluated.zip` — use this for logs and recovery

After extracting the backup, look under its `results/baseline/` directory:

```text
results/baseline/final_test_results.json    # official uncompressed expert-test metrics
results/baseline/final_test_progress.json   # completion journal
results/baseline/train_log.csv              # training curves
results/baseline/validation_log.csv         # epoch-wise validation results
results/baseline/confusion_matrices/        # confusion matrices
results/baseline/training_analysis/         # plots and reports
results/baseline/wandb_run.json             # W&B run reference
```

Other project directories include `checkpoints/`, `code/`, `configs/`, `splits/`, and `logs/`. The recovery archive is **not** a replacement for the separate AI4Mars image/mask ZIPs.

## Teammate setup (Kaggle)

1. Get access to this **private GitHub repo** and the **Kaggle dataset** `mars-terrain-v3-512`; in a new Kaggle notebook, click **Add Input** to attach the dataset.
2. Restore the four prepared dataset parts into `/tmp/mars_data/` using the data-staging cells in the baseline notebooks. Required folders: `train/`, `val/`, `test_msl/`, `test_mer/` (each with `img/` and `mask/`), plus the four split CSV files. Check counts: **9,803 / 1,192 / 311 / 195**. CSVs must retain `img_512` and `mask_512` columns.
3. Locate `mars_segformer_trained_model.zip` under `/kaggle/input/`. If it appears as a directory, use that directly; otherwise extract it to `/kaggle/working/mars_model/`. Locate the directory containing `code/`, `configs/`, and `checkpoints/`.
4. Load the **frozen model** (see below); do not run training again. The first model initialization may download `nvidia/mit-b0` from Hugging Face, so allow internet or use its cached weights.

```python
from pathlib import Path
import sys, torch, hashlib

ROOT = Path('/kaggle/working/mars_model')  # adjust if auto-extracted elsewhere
sys.path.insert(0, str(ROOT / 'code'))
import mars_common as mc  # default dataset root: /tmp/mars_data

ckpt = ROOT / 'checkpoints/baseline/frozen_best_epoch16.pt'
sha = 'afb9b155e07c617ab69cfa29455beda9318605b0afcec81e07f558a48bcbbda6'
assert hashlib.sha256(ckpt.read_bytes()).hexdigest() == sha
model = mc.new_model()
# Load only the team's trusted PyTorch checkpoint.
model.load_state_dict(torch.load(ckpt, map_location='cpu', weights_only=False)['model'])
model.eval()
assert len(mc.MarsSeg('train')) == 9803
print('Ready')
```

The segmentation data loader, preprocessing, and metrics are in `code/mars_common.py`. Match package versions to the baseline notebooks and record your runtime environment. `/tmp` and `/kaggle/working` are **temporary**; save codec checkpoints separately.

## Recorded uncompressed baseline results

| Metric | Validation (Curiosity) | Expert MSL test (311) | Expert MER test (195) |
|---|---:|---:|---:|
| mIoU4 | **0.838503** (best epoch 16) | **0.676215** | **0.700983** |
| mIoU3 | 0.935317 (at epoch 16) | 0.864864 | 0.788847 |
| Pixel accuracy | — | 0.927891 | 0.882720 |

Read the full per-class results in **`results/baseline/final_test_results.json` inside the full backup**. These are **uncompressed SegFormer** results, **not JPEG2000 or CompressAI** results. Baseline W&B run: [view run](https://wandb.ai/hudafatimah-04-rv-college-of-engineering/mars-terrain-segmentation/runs/97ff64b1ad56d530). Local CSV/JSON files are the authoritative records.

## Experiment ownership and rules

- **Teammate A:** JPEG2000 compression, reconstruction metrics, and segmentation evaluation.
- **Teammate B:** CompressAI reconstruction-only and task-aware compression, reconstruction metrics, and segmentation evaluation.
- **Both:** agree on one image/channel policy, metric implementation, actual encoded-byte accounting and bitrate targets **before production runs**. Proposed core points: **0.125 / 0.25 / 0.5 bpp** (not yet locked). Compute `bpp = 8 × encoded_bytes / (512 × 512)` using the complete decodable bitstream. Compare methods at **matched actual** bpp.
- Train and tune codecs with **Curiosity train/validation only**. `test_msl` is reserved for the one-time final compression comparison. `test_mer` remains reserved for optional later domain-shift experiments. Do **not** rerun or use the existing baseline test results to tune compressors.
- Keep SegFormer, masks, splits, preprocessing and evaluation metrics unchanged. Report **PSNR, MS-SSIM, mIoU4, mIoU3, per-class IoU**, and actual bpp.
- Log each experiment to **Weights & Biases (W&B)** and retain **local CSV/JSON, configs, plots and checkpoints**. Use Kaggle Secrets for credentials; never commit API keys.

**Start with the PRD and teammate handover, then the proposed shared protocol.** Do not rerun all four baseline notebooks or retrain SegFormer to begin compression work.
