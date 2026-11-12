from pathlib import Path
from datetime import datetime, timezone
import sys, json, hashlib, time, math
import numpy as np
import torch
from torch.utils.data import DataLoader

W = Path('/kaggle/working/mars_work')
sys.path.insert(0, str(W / 'code'))
import baseline_train as bt
import mars_common as mc

CK = W / 'checkpoints/baseline'
R = W / 'results/baseline'
FROZEN = CK / 'frozen_best_epoch16.pt'
INFO = CK / 'baseline_frozen.json'
PROGRESS = R / 'final_test_progress.json'
FINAL = R / 'final_test_results.json'


def sha256(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def json_safe(x):
    if isinstance(x, dict):
        return {str(k): json_safe(v) for k, v in x.items()}
    if isinstance(x, (list, tuple, np.ndarray)):
        return [json_safe(v) for v in x]
    if isinstance(x, np.generic):
        return json_safe(x.item())
    if isinstance(x, float):
        return x if math.isfinite(x) else None
    return x


# Never rerun completed final evaluations or overwrite the record.
if FINAL.exists():
    raise RuntimeError(f'Final test results already exist: {FINAL}. Do NOT evaluate again.')

cfg = bt.build_config()
metadata = json.loads(INFO.read_text())
expected_hash = bt.cu.config_hash(cfg)
assert metadata['status'] == 'FROZEN'
assert metadata['selected_epoch'] == 16
assert metadata['selected_iteration'] == 19600
assert metadata['config_hash'] == expected_hash
assert metadata['config'] == cfg
assert metadata['test_evaluation_performed'] is False
assert sha256(FROZEN) == metadata['checkpoint_sha256'], 'Frozen file SHA256 mismatch'
assert sha256(W / 'splits/split_v3_FROZEN.json') == metadata['frozen_split_sha256']
assert Path(mc.DATA).resolve() == Path('/tmp/mars_data').resolve()

split_sizes = {'test_msl': 311, 'test_mer': 195}
for split, size in split_sizes.items():
    assert (Path(mc.DATA) / f'{split}.csv').is_file(), f'{split} CSV unavailable'
    assert len(mc.MarsSeg(split)) == size, f'{split} size differs from frozen protocol'

if PROGRESS.exists():
    journal = json.loads(PROGRESS.read_text())
    assert journal['checkpoint_sha256'] == metadata['checkpoint_sha256']
    assert journal['config_hash'] == expected_hash
    for split in split_sizes:
        assert split in journal['splits']
else:
    journal = {
        'checkpoint_sha256': metadata['checkpoint_sha256'],
        'config_hash': expected_hash,
        'selected_epoch': 16,
        'splits': {split: {'status': 'pending'} for split in split_sizes},
    }
    bt.atomic_json(PROGRESS, journal)

# IMPORTANT: this initialization retrieves architecture, then replaces ALL
# model parameters with the approved frozen epoch-16 checkpoint.
torch.backends.cudnn.deterministic = True
torch.backends.cudnn.benchmark = False
model = mc.new_model()
state = torch.load(FROZEN, map_location='cpu', weights_only=False)
assert state['config_hash'] == expected_hash
assert int(state['iteration']) == 19600
assert int(state['epoch']) == 16
assert abs(float(state['best_metric']) - metadata['validation_miou4']) < 1e-8
model.load_state_dict(state['model'], strict=True)
model.eval()
print('Frozen epoch-16 model loaded; no training or tuning will occur.')

for split, size in split_sizes.items():
    entry = journal['splits'][split]
    if entry['status'] == 'complete':
        print(f'{split}: already evaluated, reusing saved results (not rerunning).')
        continue
    if entry['status'] != 'pending':
        raise RuntimeError(
            f'{split} was previously started but not completed. '
            f'Inspect {PROGRESS} before deciding whether to rerun it.'
        )

    entry['status'] = 'in_progress'
    entry['started_utc'] = datetime.now(timezone.utc).isoformat()
    bt.atomic_json(PROGRESS, journal)

    print(f'FINAL evaluation: {split} ({size} images)')
    loader = DataLoader(
        mc.MarsSeg(split, train=False), batch_size=cfg['val_batch_size'],
        shuffle=False, num_workers=cfg['workers'], pin_memory=True
    )
    tic = time.monotonic()
    result = mc.evaluate(model, loader)
    elapsed = time.monotonic() - tic

    entry['status'] = 'complete'
    entry['completed_utc'] = datetime.now(timezone.utc).isoformat()
    entry['image_count'] = size
    entry['duration_seconds'] = round(elapsed, 3)
    entry['metrics'] = json_safe(result)
    bt.atomic_json(PROGRESS, journal)
    print(f"{split}: mIoU4={result['miou4']:.6f} | "
          f"mIoU3={result['miou3']:.6f} | pixel accuracy={result['pixacc']:.6f}")
    for name, iou, prec, recall in zip(mc.CLASS_NAMES, result["iou"], result["precision"], result["recall"]):
        print(f"  {name}: IoU={iou:.6f} precision={prec:.6f} recall={recall:.6f}")

assert all(journal['splits'][s]['status'] == 'complete' for s in split_sizes)
report = {
    'status': 'COMPLETE',
    'protocol': 'one-time frozen SegFormer MiT-B0 baseline evaluation',
    'checkpoint_sha256': metadata['checkpoint_sha256'],
    'config_hash': expected_hash,
    'selected_epoch': metadata['selected_epoch'],
    'selected_iteration': metadata['selected_iteration'],
    'class_names': list(mc.CLASS_NAMES),
    'ignore_index': 255,
    'splits': journal['splits'],
}
assert not FINAL.exists(), 'Refusing to overwrite final evaluation results'
bt.atomic_json(FINAL, report)
print('FINAL TEST EVALUATION COMPLETE')
print('Results saved:', FINAL)
print('Progress journal:', PROGRESS)
print('No training was performed. Do not rerun these test evaluations.')
