"""mars_common.py - shared code for the Mars compression project (Kaggle version).
Reconstructed from the validated Colab notebook (Mars_Compression_01_SegFormer_Baseline).
Dataset, model, loss and metric logic are unchanged; only the data root differs."""
import os, random
import numpy as np, pandas as pd, torch, torch.nn as nn, torch.nn.functional as F
from PIL import Image
from torch.utils.data import Dataset, DataLoader

DATA = os.environ.get("MARS_DATA", "/tmp/mars_data")
CLASS_NAMES = ["soil", "bedrock", "sand", "big rock"]
DEV = "cuda" if torch.cuda.is_available() else "cpu"
USE_AMP, AMP_DT = (DEV == "cuda"), torch.float16
MEAN, STD = 0.449, 0.226
PRETRAINED = "nvidia/mit-b0"


def set_seed(s):
    random.seed(s); np.random.seed(s); torch.manual_seed(s); torch.cuda.manual_seed_all(s)


class MarsSeg(Dataset):
    def __init__(self, split, train=False, indices=None):
        self.d = pd.read_csv(f"{DATA}/{split}.csv")
        if indices is not None:
            self.d = self.d.iloc[list(indices)].reset_index(drop=True)
        self.train = train
        required = {"img_512", "mask_512"}
        assert required.issubset(self.d.columns), f"Missing CSV columns: {required - set(self.d.columns)}"

    def __len__(self):
        return len(self.d)

    def __getitem__(self, i):
        r = self.d.iloc[i]
        img_path, mask_path = os.path.join(DATA, r.img_512), os.path.join(DATA, r.mask_512)
        img = np.array(Image.open(img_path).convert("L"), dtype=np.uint8)
        msk = np.array(Image.open(mask_path), dtype=np.uint8)
        assert img.shape == (512, 512), img_path
        assert msk.shape == (512, 512), mask_path
        if self.train and torch.rand(1).item() < 0.5:      # same flip for image and mask
            img = np.fliplr(img); msk = np.fliplr(msk)
        x = torch.from_numpy(np.ascontiguousarray(img)).float().div_(255.0).unsqueeze(0)
        y = torch.from_numpy(np.ascontiguousarray(msk)).long()
        return x, y


def make_loaders(bs=8, seed=42, workers=2):
    g = torch.Generator(); g.manual_seed(seed)
    train_loader = DataLoader(MarsSeg("train", train=True), batch_size=bs, shuffle=True, drop_last=True,
                              num_workers=workers, pin_memory=True, generator=g, persistent_workers=workers > 0)
    val_loader = DataLoader(MarsSeg("val"), batch_size=16, shuffle=False, num_workers=workers, pin_memory=True)
    return train_loader, val_loader


def make_train_eval_idx(n_train=None, k=1000):
    """Same rule as the Colab notebook: RandomState(0).choice(n_train, 1000, replace=False), sorted."""
    n_train = n_train or len(pd.read_csv(f"{DATA}/train.csv"))
    return sorted(np.random.RandomState(0).choice(n_train, min(k, n_train), replace=False).tolist())


class SegWrap(nn.Module):
    """Input: B x 1 x H x W float in [0,1]. Output: B x 4 x H x W logits upsampled to the input size."""
    def __init__(self, pretrained=PRETRAINED):
        super().__init__()
        from transformers import SegformerForSemanticSegmentation, SegformerConfig
        id2label = {i: n for i, n in enumerate(CLASS_NAMES)}; label2id = {n: i for i, n in id2label.items()}
        if pretrained:
            self.net = SegformerForSemanticSegmentation.from_pretrained(
                pretrained, num_labels=4, id2label=id2label, label2id=label2id)
        else:
            self.net = SegformerForSemanticSegmentation(
                SegformerConfig(num_labels=4, id2label=id2label, label2id=label2id))

    def forward(self, x):
        h, w = x.shape[-2:]
        x = ((x - MEAN) / STD).repeat(1, 3, 1, 1)
        return F.interpolate(self.net(pixel_values=x).logits, size=(h, w), mode="bilinear", align_corners=False)


def new_model():
    return SegWrap().to(DEV)


def metrics_from_conf(conf, loss=None):
    """conf[i, j] = pixels with true class i predicted as class j (label 255 never enters)."""
    conf = np.asarray(conf, dtype=np.float64); tp = np.diag(conf); gt = conf.sum(1); pr = conf.sum(0); union = gt + pr - tp
    with np.errstate(divide="ignore", invalid="ignore"):
        iou = np.where(union > 0, tp / union, np.nan);  rec = np.where(gt > 0, tp / gt, np.nan)
        prec = np.where(pr > 0, tp / pr, np.nan);       dice = np.where(gt + pr > 0, 2 * tp / (gt + pr), np.nan)
    return dict(loss=loss, miou4=float(np.nanmean(iou)), miou3=float(np.nanmean(iou[:3])),
                pixacc=float(tp.sum() / conf.sum()), iou=iou.tolist(), recall=rec.tolist(),
                precision=prec.tolist(), dice=dice.tolist(), conf=conf.astype(np.int64).tolist())


@torch.no_grad()
def evaluate(model, loader, max_batches=None):
    model.eval(); conf = torch.zeros(16, dtype=torch.long, device=DEV); loss_sum, n_valid = 0.0, 0
    for b, (x, y) in enumerate(loader):
        if max_batches and b >= max_batches: break
        x, y = x.to(DEV, non_blocking=True), y.to(DEV, non_blocking=True)
        with torch.autocast(DEV, dtype=AMP_DT, enabled=USE_AMP): logits = model(x)
        logits = logits.float(); v = y != 255
        loss_sum += F.cross_entropy(logits, y, ignore_index=255, reduction="sum").item(); n_valid += int(v.sum())
        conf += torch.bincount(y[v] * 4 + logits.argmax(1)[v], minlength=16)
    return metrics_from_conf(conf.view(4, 4).cpu().numpy(), loss_sum / max(n_valid, 1))


def train_step(model, opt, scaler, x, y):
    model.train(); x, y = x.to(DEV, non_blocking=True), y.to(DEV, non_blocking=True)
    opt.zero_grad(set_to_none=True)
    with torch.autocast(DEV, dtype=AMP_DT, enabled=USE_AMP): logits = model(x)
    loss = F.cross_entropy(logits.float(), y, ignore_index=255)
    scaler.scale(loss).backward(); scaler.unscale_(opt)
    gn = nn.utils.clip_grad_norm_(model.parameters(), 1e9)     # only MEASURES the norm (no real clipping)
    scaler.step(opt); scaler.update()
    return loss.item(), float(gn)
