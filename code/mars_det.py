"""mars_det.py - deterministic training data stream (order + flips = pure functions of seed/epoch/index).
MarsSeg in mars_common.py is untouched; pixel loading is delegated to it, so unflipped samples are identical.
Resuming needs only the iteration number. Worker count does not affect the result."""
import hashlib, functools
import numpy as np, torch
from torch.utils.data import Dataset, DataLoader
import mars_common as mc


def _h(*parts):
    return int.from_bytes(hashlib.sha256("|".join(map(str, parts)).encode()).digest()[:8], "big")


@functools.lru_cache(maxsize=8)
def epoch_order(seed, epoch, n):
    return np.random.RandomState(_h("order", seed, epoch, n) % (2 ** 32)).permutation(n)


def flip_flag(seed, epoch, idx):
    return _h("flip", seed, epoch, int(idx)) & 1


def sample_at(seed, bs, n, it, r):
    """(epoch, dataset index, flip flag) of sample r (0..bs-1) in the batch at iteration `it`."""
    epoch, pos = divmod(it, n // bs)                 # drop_last: the final n % bs images of an epoch are unused
    idx = int(epoch_order(seed, epoch, n)[pos * bs + r])
    return epoch, idx, flip_flag(seed, epoch, idx)


def batch_plan(seed, bs, n, it):
    rows = [sample_at(seed, bs, n, it, r) for r in range(bs)]
    return rows[0][0], [r[1] for r in rows], [r[2] for r in rows]


def plan_hash(seed, bs, n, n_iters):
    h = hashlib.sha256()
    for it in range(n_iters):
        h.update(repr(batch_plan(seed, bs, n, it)).encode())
    return h.hexdigest()


class DetTrainDataset(Dataset):
    """Item j is sample (j % bs) of the batch at iteration start_iter + j // bs. Use batch_size=bs, shuffle=False."""
    def __init__(self, seed, bs, start_iter, end_iter, flip=True, split="train"):
        self.base = mc.MarsSeg(split, train=False)
        self.n, self.seed, self.bs, self.flip = len(self.base), seed, bs, flip
        self.k0, self.k1 = start_iter * bs, end_iter * bs

    def __len__(self):
        return self.k1 - self.k0

    def load(self, idx, do_flip):
        x, y = self.base[idx]
        if do_flip:
            x, y = torch.flip(x, dims=[-1]), torch.flip(y, dims=[-1])
        return x, y

    def __getitem__(self, j):
        it, r = divmod(self.k0 + j, self.bs)
        _, idx, fl = sample_at(self.seed, self.bs, self.n, it, r)
        return self.load(idx, bool(fl) and self.flip)


def make_det_loader(seed, bs, start_iter, end_iter, workers=2, flip=True):
    ds = DetTrainDataset(seed, bs, start_iter, end_iter, flip)
    return DataLoader(ds, batch_size=bs, shuffle=False, drop_last=False, num_workers=workers,
                      pin_memory=True, persistent_workers=workers > 0)
