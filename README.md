[README.md](https://github.com/user-attachments/files/35219070/README.md)
# Mars Terrain Compression — Research Project

## Overview

This project compares three image-compression methods for Martian terrain imagery:

1. **JPEG2000** — conventional image compression.
2. **CompressAI reconstruction-only** — learned image compression optimised for reconstruction.
3. **CompressAI task-aware** — learned image compression additionally optimised for terrain segmentation.

**Primary objectives:** Compare reconstructed-image quality (PSNR, MS-SSIM) and terrain-segmentation performance (mIoU) at matched **actual bits per pixel (bpp)**.

**Current status:** Dataset preparation, SegFormer training and uncompressed baseline evaluation are complete. The new Kaggle notebook reproduced the frozen model's uncompressed validation scores. JPEG2000 bitrate and reconstruction calibration is complete on all 1,192 validation images. Compressed-image segmentation, learned-codec calibration and the final comparison are pending.

**Start here:** [Shared compression protocol v1.1 draft](documentation/shared_compression_protocol_v1.1.json). It records the fixed bitrate targets and the learned-codec settings still awaiting joint sign-off.

## Project storage

### GitHub — Code, documentation and experimental records

Repository: https://github.com/hudafatimah04/mars_compression

| Location | Description |
|---|---|
| `notebooks/` | Data preparation, SegFormer development and evaluation, and the new codec feasibility and calibration notebook |
| `code/` | Shared dataset loader, model, checkpoint, deterministic training, W&B and LR-pilot utilities |
| `configs/` | Formal learning-rate pilot configuration |
| `splits/` | Final V3 train/validation/MSL/MER split CSVs |
| `logs/` | Pilot training logs, validation logs and dataset/split verification |
| `results` | Three candidate experiments, verification and final LR selection |
| `results` | Official uncompressed SegFormer test results |
| `baseline_final_eval_cell.py` | Archived final baseline evaluation code; do not rerun completed tests |
| [Shared protocol v1.1 draft](documentation/shared_compression_protocol_v1.1.json) | Current bitrate, byte accounting, validation and evaluation rules |
| [JPEG2000 validation calibration ZIP](results/jpeg2000_calibration.zip) | Per-image results, summary and reconstruction examples |

The repository also includes the **PRD**, **teammate handover** and **technical roadmap**.

### Kaggle — Dataset and trained model

Dataset: `mars-terrain-v3-512`, maintained by `hudafatimah`.

Attach it through **Kaggle → Add Input** after receiving dataset access.

| Kaggle asset | Purpose |
|---|---|
| `dataset_v3_512_train_part1.zip` | First training-data package |
| `dataset_v3_512_train_part2.zip` | Second training-data package |
| `dataset_v3_512_train_part3.zip` | Third training-data package |
| `dataset_v3_512_val_test_csv.zip` | Validation/test images and masks, CSVs and preprocessing metadata |
| `split_v3_FROZEN.json` | Frozen data-split definition |
| `mars_segformer_trained_model.zip` | Frozen model, configuration and essential Python modules |
| `backup_baseline_final_evaluated.zip` | Full baseline project recovery archive, including training history and results |

## Prepared dataset

**AI4Mars merged v0.6**, grayscale images and masks at 512 × 512 resolution, stored as lossless PNG.

| Split | Images | Use |
|---|---:|---|
| `train` | 9,803 | Curiosity training |
| `val` | 1,192 | Curiosity validation and model selection |
| `test_msl` | 311 | Expert-labelled Curiosity final testing |
| `test_mer` | 195 | Expert-labelled Spirit/Opportunity testing |

Terrain labels: `0=soil`, `1=bedrock`, `2=sand`, `3=big rock`, `255=ignore`.

Never regenerate or modify the frozen splits. Do not use either test set for codec training, hyperparameter tuning or checkpoint selection.

## SegFormer baseline

Architecture: **SegFormer MiT-B0**, pretrained encoder `nvidia/mit-b0`, four-class segmentation head.

Training: **20 epochs**, batch size 8, AdamW, selected learning rate `1e-4`, seed 42, cosine learning-rate decay and FP16 AMP.

Best checkpoint: **epoch 16**, iteration **19,600**, selected using validation mIoU4.

The same frozen model must be used to evaluate all three compression methods.

### Model-sharing ZIP

Extract `mars_segformer_trained_model.zip` from Kaggle. Important contents:

- `checkpoints/baseline/frozen_best_epoch16.pt` — official model
- `checkpoints/baseline/baseline_frozen.json` — checkpoint metadata
- `configs/baseline_protocol.json` — model-training configuration
- `code/mars_common.py` — dataset loading, SegFormer and evaluation
- `code/ckpt_utils.py`, `mars_det.py`, `tracking.py`, `recovery.py`, `baseline_train.py` — supporting implementation

**Checkpoint SHA256:**

`afb9b155e07c617ab69cfa29455beda9318605b0afcec81e07f558a48bcbbda6`

Do not retrain or replace SegFormer. Load this trusted checkpoint using the existing project code.

### Full evaluated backup

`backup_baseline_final_evaluated.zip` is intended for recovery and historical results, not routine inference.

Its key files are located under `results/baseline/`:

- `final_test_results.json` — official uncompressed test metrics
- `final_test_progress.json` — completed evaluation record
- `train_log.csv` and `validation_log.csv` — training history
- `confusion_matrices/` — segmentation confusion matrices
- `training_analysis/` — validation and training plots
- `wandb_run.json` — W&B run reference

It also contains the project checkpoints, code, configuration and frozen split.

## Recorded baseline results

| Metric | Validation | MSL test | MER test |
|---|---:|---:|---:|
| mIoU4 | **0.838503** | **0.676215** | **0.700983** |
| mIoU3 | 0.935317 | 0.864864 | 0.788847 |
| Pixel accuracy | — | 0.927891 | 0.882720 |

These values are for **uncompressed images**, not JPEG2000 or CompressAI.

### Learning-rate pilot

Three candidates were tested, each for four epochs:

| Learning rate | Selection mIoU4 score |
|---|---:|
| `3e-5` | 0.779816 |
| **`1e-4`** | **0.813566** |
| `3e-4` | 0.791311 |

The selected learning rate was **`1e-4`**. Full evidence is available in `results/lr_pilot/lr_selection.json`, candidate logs and verification reports.

Baseline W&B run: https://wandb.ai/hudafatimah-04-rv-college-of-engineering/mars-terrain-segmentation/runs/97ff64b1ad56d530

## Teammate setup

1. Get access to this GitHub repository and the private Kaggle dataset.
2. Create a Kaggle notebook and attach `mars-terrain-v3-512` using **Add Input**.
3. Locate the dataset ZIPs under `/kaggle/input/`. Reconstruct the prepared dataset using the existing notebook staging procedure. The original baseline used `/tmp/mars_data/`.
4. Verify the image/mask folders, CSVs and expected split counts.
5. Locate and extract `mars_segformer_trained_model.zip`, if not already expanded by Kaggle.
6. Add its `code/` directory to the Python path, verify the checkpoint SHA256 and load the frozen SegFormer using the existing model-loading utilities.
7. Use the same segmentation preprocessing and metrics for every codec. Do not run the baseline notebooks from the beginning or repeat the completed expert-test evaluations.
8. Save codec checkpoints, local logs and W&B records persistently; Kaggle runtime storage is temporary.

## Compression experiments

### Validation checks and bitrate calibration

The [Kaggle notebook](notebooks/notebook7d8f915b5f%20%281%29.ipynb) contains the pretrained CompressAI feasibility check (cell 5), the frozen-model setup and uncompressed validation check (cells 9–10), and the full JPEG2000 calibration (cell 12).

The [JPEG2000 calibration ZIP](results/jpeg2000_calibration.zip) contains `summary.json`, `per_image.csv` and `what_compression_does.png`. Its 3,576 rows cover three settings on the same ordered 1,192-image validation split.

| Target bpp | JPEG2000 mean actual bpp | Mean PSNR (dB) | Mean MS-SSIM |
|---:|---:|---:|---:|
| 0.125 | 0.124926 | 33.107 | 0.9356 |
| 0.250 | 0.249925 | 35.496 | 0.9675 |
| 0.500 | 0.500110 | 38.492 | 0.9857 |

These are **validation reconstruction results**. The ZIP contains no segmentation scores on compressed images. The 12-image pretrained CompressAI pilot was a feasibility check. Only the 0.250 bpp target was within the shared band on that subset. Both learned arms still need full-validation calibration.

### Shared rules and parallel work

- **Fixed targets:** 0.125, 0.250 and 0.500 bpp. Each arm must reach within **±5% of the target mean actual bpp** on the same ordered validation list. Report achieved bpp.
- **Byte accounting:** `actual_bpp = 8 × total_decodable_bytes / (512 × 512)`. Count the complete raw J2K codestream or complete serialized learned payload.
- **Teammate A:** Run the frozen SegFormer on JPEG2000 reconstructions at the calibrated settings. Save results in `results/jpeg2000/`.
- **Teammate B:** Set up CompressAI and check real serialized encode/decode. Agree on the architecture, container, training budget and loss settings before full training. Save results separately in `results/learned_rd/` and `results/learned_task/`.
- **Both:** Use the same frozen SegFormer, preprocessing and evaluation metrics. Keep local CSV/JSON/configuration files and record experiment links. Freeze the three arms before the final MSL comparison. Use train and validation for all development and checkpoint selection.

See the [v1.1 protocol draft](documentation/shared_compression_protocol_v1.1.json) for the validation manifest checksum, grayscale handling, metrics and remaining decisions.
