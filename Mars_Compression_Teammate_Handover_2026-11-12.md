# Mars Terrain Compression — Teammate Handover

**Prepared:** 12 November 2026  
**For:** Teammate responsible for CompressAI reconstruction-only and task-aware learned image compression, and the ChatGPT assistant supporting her.  
**Status:** Baseline SegFormer complete and frozen. JPEG2000 and CompressAI arms not yet implemented in this phase. Numerical bitrate proposal **requires agreement by both teammates before production experiments**.

## 1. Project purpose and current scope

This is a **controlled comparative study**, not an attempt to invent a new codec, claim that NASA uses our method, or implement a rover flight system. Compare:

1. **Conventional JPEG2000** — implemented by teammate A.
2. **Reconstruction-only learned image compression** — implemented by teammate B using CompressAI.
3. **Task-aware learned image compression** — implemented by teammate B using the **same CompressAI codec architecture** as Method 2, with an additional terrain-segmentation loss.

**Primary RQ1 (image reconstruction):** At matched actual encoded bitrates, how faithfully do the three methods reconstruct 512×512 Mars images (PSNR, MS-SSIM)?

**Primary RQ2 (terrain segmentation):** At matched actual encoded bitrates, how well do the decoded images preserve performance of the **same frozen SegFormer**, measured by mIoU4, mIoU3 and per-class IoU? In particular, does adding a segmentation-aware objective provide benefit beyond reconstruction-only learned compression, and at what reconstruction-quality cost?

**Deferred optional RQ3:** Cross-rover generalisation to Spirit/Opportunity (MER). **Do not spend time on this yet**. The immediate study uses Curiosity/MSL; MER is reserved for an optional later analysis if time and scope allow.

A segmentation-only / direct latent-to-mask decoder is **not in the current scope**. Both CompressAI variants must reconstruct a decoded image, which is passed to the frozen SegFormer at evaluation. The task-aware training path can backpropagate through SegFormer to codec outputs, but **SegFormer weights do not change**.

## 2. Team ownership and handoff

| Responsibility | Owner |
|---|---|
| Dataset preparation, splits, frozen SegFormer training and baseline evaluation | Teammate A — complete |
| JPEG2000 implementation, bitrate calibration, decoded images, metrics | Teammate A — next |
| CompressAI reconstruction-only arm | Teammate B |
| CompressAI task-aware arm | Teammate B |
| Shared protocol sign-off, bitrate matching, plots, interpretation, report | Both |

Keep separate work folders/repositories or clearly separated directories; use **one shared protocol and results schema**, never independently redefine the evaluation metric or image representation.

## 3. Ground truth and dataset

**AI4Mars merged v0.6**, canonical **512×512** images and masks. Frozen split file: `splits/split_v3_FROZEN.json`.

| Split | Rover/domain | Count | Permitted use now |
|---|---|---:|---|
| `train` | Curiosity/MSL | 9,803 | Train learned compressors |
| `val` | Curiosity/MSL | 1,192 | Codec development, bitrate tuning, checkpoint selection, dry-run comparisons |
| `test_msl` | Curiosity/MSL, expert labelled | 311 | **One final compression-method comparison only**, after protocol/checkpoints are fixed |
| `test_mer` | Spirit/Opportunity/MER, expert labelled | 195 | Hold for optional later cross-rover study; no current tuning |

Masks: `0=soil`, `1=bedrock`, `2=sand`, `3=big rock`, `255=ignore`. Some images are grayscale; the already-validated `code/mars_common.py` repeats grayscale to 3 channels for SegFormer. **Do not change split membership, labels, class mapping, image size, baseline segmentation preprocessing, or ignore-label handling.**

**Kaggle source dataset:** `mars-terrain-v3-512`, in the original owner's account. Original owner-session path was `/kaggle/input/datasets/hudafatimah/mars-terrain-v3-512`; the path may differ on the teammate's account. Source contains data parts, split JSON and CSVs. Temporary assembled data was `/tmp/mars_data`; it **will not already exist in a new Kaggle session**. Verify availability of the data and reconstruct or remap as needed; never assume the original owner's working directory persists. Source dataset is separate from the trained-model checkpoint.

## 4. Frozen SegFormer model — DO NOT RETRAIN

- Architecture: four-class Hugging Face SegFormer with MiT-B0 (`nvidia/mit-b0`) encoder.
- Best model: `checkpoints/baseline/frozen_best_epoch16.pt`.
- Selection: epoch **16**, iteration **19,600** (best Curiosity validation mIoU4 **0.838503**).
- Frozen model SHA256: `afb9b155e07c617ab69cfa29455beda9318605b0afcec81e07f558a48bcbbda6`.
- Config hash: `2e177076344b5638`.
- Metadata: `checkpoints/baseline/baseline_frozen.json`.
- Shareable archive: **`mars_segformer_trained_model.zip`** (41.44 MB, 9 files, already produced by Teammate A). It includes the frozen checkpoint, configuration, and core model/training code. Preserve relative paths.
- Full research recovery archive: `backup_baseline_frozen_pretest.zip` (556,409,028 bytes; 115 files). A `backup_baseline_final_evaluated.zip` may also exist if produced and downloaded; confirm before referring to it as available.

Final **uncompressed** baseline tests were already run and saved. These values are historical references, **not settings for choosing compressor hyperparameters**:

| Metric | MSL (311 images) | MER (195 images) |
|---|---:|---:|
| mIoU4 | 0.676215 | 0.700983 |
| mIoU3 | 0.864864 | 0.788847 |
| pixel accuracy | 0.927891 | 0.882720 |

The baseline test evaluation must **not be repeated**, and neither test set may be used for compressor selection. The trained baseline used seed 42, 20 epochs/24,500 iterations, AdamW, selected LR 1e-4; these are **historical SegFormer settings, not automatically the compressor hyperparameters**.

Loading caveat: the `.pt` is a checkpoint, **not** a self-contained image-processing program. Read the provided `mars_common.py`, configuration and checkpoint-loading code. Construct the matching model and load the frozen weights as implemented; verify the SHA256 first. Never load a checkpoint from an untrusted source.

## 5. Proposed shared bitrate contract — NOT YET APPROVED

The earlier handover specified **matched actual bits per pixel** but did **not** choose exact numerical targets. To avoid two people selecting incompatible rates, propose these **three core target operating points** for discussion and joint confirmation:

| Target bpp | Equivalent target encoded payload at 512×512 | Interpretation |
|---:|---:|---|
| **0.125** | **4,096 bytes/image** | Low-rate, higher compression |
| **0.250** | **8,192 bytes/image** | Medium-rate |
| **0.500** | **16,384 bytes/image** | Higher-rate |

Optionally add **1.000 bpp** (32,768 bytes/image) **only if both teammates explicitly approve** and compute budget allows. These are **proposals, not established experiment results or previously locked PRD numbers**. Do a small `train`/`val` feasibility check; if a learned codec cannot reach a proposed target, agree on a new common target **before** the final testing phase. Do not silently substitute another bpp on one arm.

For a single 512×512 image:

`actual_bpp = (8 × total_decodable_encoded_bytes) / (512 × 512)`.

Count **actual bytes emitted by the entropy coder / image codec**, including all streams and any required decoding side information (e.g., per-image shape/header and necessary coding metadata). Use consistent accounting for JP2/J2K and learned codec (document any container overhead convention); do **not** equate JPEG2000 quality or `rate` settings, estimated entropy, learned loss `R`, or a model-quality index with actual bpp. Do **not** include labels or segmentation masks in the transmitted representation.

Report per-image actual bpp and **mean actual bpp over the identical fixed validation/evaluation image list**. Calibrate quality settings or rate–distortion lambda using `train`/`val` only. Working matching criterion: **each arm's measured mean validation bpp should lie within ±5% of the agreed target**; if not feasible, flag it instead of claiming a matched point. In analysis, always report the achieved bpp, and do not hide mismatch. Additional rate–distortion curves can show real achieved points; interpolating is permissible only if documented, and does not turn unmatched actual bitstreams into exact matched test examples.

**Team sign-off required before real experiments:** numerical targets, tolerance, grayscale/channel policy, JPEG2000 container and byte-accounting policy, bitstream metadata conventions, and which frozen validation subset (if any) is used for preliminary calibration. Once agreed, version the written protocol and do not change it silently.

## 6. Critical image/metric contract (both teammates)

1. Original/reference images are the **same canonical 512×512 image pixels**, not the train-time colour-normalised float tensor. Lossy compression operates on a documented image representation and decoder output is brought back to the same image domain. Preserve exact reference scaling, number of channels and colour mode. The segmentation preprocessing remains the one in `mars_common.py`.
2. Some inputs are grayscale; both people must first agree **one identical coding input policy** (e.g., canonical 3-channel RGB with grayscale channels repeated, matching SegFormer input). Do not have JPEG2000 encode 1-channel while CompressAI encodes duplicated 3-channel images **without explicitly documenting the choice and its implications**. Verify actual input modes in the source data and model code before signing off.
3. All methods reconstruct an image. Run the **same frozen epoch-16 SegFormer** on each method's reconstructed image, using exactly the original resizing/normalisation, label handling and prediction rules. No codec-specific fine-tuning of SegFormer.
4. PSNR on the same scaled original and reconstructed images, with a documented data range. MS-SSIM with same implementation/data range for all arms. Report image-wise values and clearly state aggregation (prefer mean over same image list); keep the exact function/version in the protocol.
5. For segmentation, use the existing confusion-matrix calculation and aggregate over the **whole dataset**; report `miou4`, `miou3`, pixel accuracy, per-class IoU, recall and precision. Ignore class 255. Do not average per-image mIoUs if the existing evaluator uses accumulated confusion matrices.
6. Use the **same exact ordered image ID list** and frozen split for each method; preserve file IDs in CSV outputs. Store decoded outputs for a small **preselected validation image subset** for visual comparisons; no cherry-picking based on test results.
7. Record encoded byte size and decode success for every image. If a reconstruction fails, report the failure and use an agreed rule, not silent sample dropping.

## 7. CompressAI work package — Teammate B

### Method 2: reconstruction-only learned codec

- Choose one established, supported CompressAI architecture (specific name/version **requires team confirmation**; not determined by the handover). Record installed CompressAI/PyTorch/CUDA versions, pretrained checkpoint origin if any, weights hash and codec settings.
- Train/tune using Curiosity `train` only; validate using `val`. Optimise rate plus image distortion **without any segmentation-loss term**.
- Produce real encoded bitstreams via the codec's entropy encoder and corresponding decoder. Use `compress()` / `decompress()` or documented equivalent, and initialise/update entropy coding tables as the specific codec requires.
- Aim for each of the signed-off bpp targets; checkpoint and record achieved validation bpp, PSNR, MS-SSIM and frozen-SegFormer validation segmentation metrics. Validation segmentation here is evaluation only, not a training signal.

### Method 3: task-aware learned codec

- Use the **same underlying codec architecture and, per bitrate, a matched initialisation and comparable training schedule** as Method 2. Change primarily the optimisation objective by adding task loss.
- Keep image reconstruction: a decoder must still produce a reconstructed image usable for PSNR/MS-SSIM and SegFormer inference.
- A typical objective is `L = R_weight*rate + D_weight*reconstruction_distortion + T_weight*segmentation_loss`, with all weights defined in an explicit config. Do **not** copy numerical loss weights from the historical SegFormer LR pilot.
- During codec training, pass reconstructed images through the **frozen** SegFormer; the segmentation loss can backpropagate to the codec, but SegFormer parameters and BatchNorm/statistics must not be updated. For task CE use the existing labels and `ignore_index=255`; mask resizing and logits alignment must match the frozen evaluation policy.
- If initialising Method 3 from a trained Method 2 checkpoint, disclose the extra optimisation budget and use a comparable reconstruction-only continued-training control or get team agreement on that confound. Simplest controlled comparison is common initial weights and comparable total optimisation steps.
- Select codecs/rates/loss weights on `train`/`val` only; **no test_msl or test_mer access for tuning**.

### Do not add

No new segmentation model, latent-only mask decoder, new codec invention, DeepJSCC, channel simulation, onboard-hardware claim, domain-adaptation method, test-time adaptation, or extra downstream task. No separate learned model for MER in current phase.

## 8. JPEG2000 work package — Teammate A

- Use a specified, reproducible JPEG2000 encoder/decoder (record program/library, version, exact options, JP2 versus raw J2K format, reversible vs irreversible wavelet as appropriate).
- Calibrate compression parameters against the **same agreed actual validation bpp targets**, not against the learned model's quality parameter or nominal file compression percentage.
- Decode and compute **exactly the same** actual bpp, PSNR, MS-SSIM, and frozen-SegFormer terrain metrics as Method 2 and Method 3.
- Document codec setup and preserve per-image records. Do not change SegFormer. JPEG2000 is a **conventional proxy** relevant to the historical ICER context, **not** a claim of reproducing NASA flight software.

## 9. W&B tracking — required for this team phase; local records remain authoritative

W&B **Weights & Biases** must be used for the compression study's training/validation curves and experiment comparison, provided connectivity is available. **Log locally regardless** so loss of W&B does not invalidate a run.

- Both teammates should agree on **one shared W&B entity/team and project** (suggested project slug: `mars-compression-comparison`; actual access/entity must be agreed). Invite both to see the runs. Use separate `group`/`job_type`: `jpeg2000`, `learned_rd`, `learned_task`. Each bitrate/seed/config gets its own identified run.
- Log common config: method, owner, codec architecture, input/channel policy, selected model hash, split SHA256, target bpp, rate loss weight, distortion loss definition, segmentation loss weight, seed, training epochs/steps, input image size, codec software versions, git commit if used.
- For learned training: `train/loss_total`, `train/rate_est_bpp`, `train/distortion`, `train/seg_loss` (task-aware only), LR, iteration, elapsed time.
- At each evaluation point on `val`: `val/actual_bpp`, `val/psnr_db`, `val/ms_ssim`, `val/miou4`, `val/miou3`, per-class IoU, codec bitstream size and encode/decode time when measured.
- Store local `*.csv`, `*.json`, config, SHA256, full checkpoints and decoded-image examples; keep W&B run links/IDs in local metadata. Final plots use **measured bpp**, not nominal target labels.
- Auth: each collaborator uses **her own W&B account** and puts `WANDB_API_KEY` in Kaggle Secrets. Never paste tokens in GPT, code, notebook outputs, GitHub, or ZIPs. If offline, store local data, use W&B offline sync later, and notify teammate.
- Existing baseline W&B run (historical reference, subject to access permission): `https://wandb.ai/hudafatimah-04-rv-college-of-engineering/mars-terrain-segmentation/runs/97ff64b1ad56d530`.

## 10. Required common output interface

Each person must produce the same **per-image CSV** with at least:

`method,codec_id,checkpoint_sha256,split,image_id,target_bpp,actual_bpp,encoded_bytes,psnr_db,ms_ssim,decoded_ok,eval_protocol_version`

After segmentation evaluation, include either separate per-image segmentation records or aggregate confusion matrices per method, bitrate and split. Preserve image IDs so rows can be aligned later.

Each operating-point **summary JSON/CSV** must contain:

`method,codec_id,checkpoint_sha256,split,n_images,target_bpp,mean_actual_bpp,mean_psnr_db,mean_ms_ssim,miou4,miou3,pixel_accuracy,iou_soil,iou_bedrock,iou_sand,iou_bigrock,eval_protocol_version,wandb_run_url`.

Also save: exact software versions, train/val checkpoint-selection reason, `config.json`, decoded-image examples for preselected validation IDs, and encoded-byte accounting description. Consistent filenames recommended: `results/{method}/{split}/bpp_{target}/per_image.csv`, `summary.json`, `confusion.json`.

**Test protocol:** Once both teammates agree that all codec operating points are frozen, run each compressed **`test_msl`** result once using the fixed evaluator; save immutable reports. The *uncompressed SegFormer baseline tests have already been performed*, so do not rerun them. MER remains held for optional future work. Do not adjust models after inspecting compressed test results.

## 11. Collaboration and sharing

**Send teammate B these exact items:**

1. This updated handover document **first**; it supersedes the 11 November historical handover for project status and immediate priorities.
2. `mars_segformer_trained_model.zip` (41.44 MB), with frozen checkpoint, baseline metadata, configs and core code. Verify the SHA256 of the embedded `.pt` after extraction.
3. `splits/split_v3_FROZEN.json` and actual split CSVs / file-ID manifest if not already available in her attached Kaggle dataset.
4. Access to the original **Kaggle dataset** `mars-terrain-v3-512` through Dataset **Settings → Sharing**, adding her Kaggle account as `Can view` collaborator if the dataset is private. Invite her **separately** to a private notebook if she needs it; dataset access and notebook sharing are separate.
5. Latest Kaggle notebook `.ipynb` (optional for operating the learned codecs, helpful for baseline model loading and environment), plus `code/baseline_final_eval.py` or original `baseline_final_eval_cell.py` if available, **without running baseline tests again**.
6. `results/baseline/final_test_results.json` as a reference-only historical baseline; if sharing this early, explicitly prohibit using it for compression tuning. Alternatively, keep it with Teammate A until final comparison.
7. One agreed W&B project link with appropriate access; **do not share passwords/API keys**.

**Where to put what:**
- **GitHub private repo**: source code, notebooks, handover, shared protocol, requirements, lightweight results CSV/JSON and plotting scripts. No dataset archives, huge backup ZIPs or secrets. GitHub web upload has a 25 MiB/file limit; normal Git blocks >100 MiB. Use Drive for the model ZIP rather than overloading Git.
- **Kaggle private shared dataset**: actual image/mask dataset and split assets, so she can attach it to her own notebook without copying files to GitHub.
- **Google Drive / college storage, access restricted**: model ZIP (41.44 MB), final recovery backups and large immutable checkpoints; share links.
- **W&B**: run curves, configurations and dashboard, with local CSV/JSON always preserved.

Before starting production training, both teammates must explicitly approve a single version of `shared_compression_protocol.json`. Each should mark any proposed change and get the other's confirmation before deviating.

## 12. Instructions to your ChatGPT assistant (Teammate B)

You are assisting with **only** the CompressAI reconstruction-only and task-aware arms of a controlled Mars terrain compression comparison. Read this handover, attached `mars_segformer_trained_model.zip`, and the actual dataset/split files **before writing implementation-dependent code**. Do not ask her to train SegFormer again. Do not touch/re-tune test MSL/MER. Begin with a concise readiness check: inspect the archive's code/config/checkpoint structure, frozen-model hash, dataset path and split integrity (use existing evidence where possible), available GPU/dependencies, and the **unapproved shared bitrate proposal**.

**First action**: help her inspect a suitable CompressAI codec and prepare a short proposed configuration for joint sign-off (same architecture across learned arms, reproducible rate/distortion/task losses, training budget, three preliminary validation bpp targets, precise byte accounting and grayscale policy). **Do not start full training until both teammates agree on the shared protocol**. Provide complete, copy-paste Kaggle code when requested; prefer incremental checkpoints and validated local logs, use W&B without storing keys, and keep methods/results folders distinct. Never claim to execute actions in her Kaggle runtime.

The research question is **not** whether learned coding can send only a semantic mask. Both learned arms must reconstruct an image. Primary outcomes are image reconstruction fidelity **and** preserved terrain segmentation at matched real bitrates. Domain shift is optional later.
