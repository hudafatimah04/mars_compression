"""ckpt_utils.py - atomic resumable checkpoints, RNG state handling, LR schedule."""
import os, math, json, random, hashlib
import numpy as np, torch

REQUIRED = ["model", "optimizer", "scheduler", "scaler", "epoch", "iteration",
            "rng", "config", "config_hash", "best_metric"]


def config_hash(cfg):
    return hashlib.sha256(json.dumps(cfg, sort_keys=True, default=str).encode()).hexdigest()[:16]


def get_rng_state():
    return {"python": random.getstate(), "numpy": np.random.get_state(), "torch": torch.get_rng_state(),
            "cuda": torch.cuda.get_rng_state_all() if torch.cuda.is_available() else None}


def set_rng_state(s):
    random.setstate(s["python"]); np.random.set_state(s["numpy"]); torch.set_rng_state(s["torch"].cpu())
    if s["cuda"] is not None and torch.cuda.is_available():
        torch.cuda.set_rng_state_all([t.cpu() for t in s["cuda"]])


def lr_factor(it, total, warmup=100, final_frac=0.05):
    """Multiplier on the peak LR after `it` optimiser steps: linear warmup, then cosine decay to final_frac."""
    if it < warmup:
        return (it + 1) / warmup
    p = min(1.0, (it - warmup) / max(1, total - warmup))
    return final_frac + (1 - final_frac) * 0.5 * (1 + math.cos(math.pi * p))


def make_scheduler(opt, total, warmup=100, final_frac=0.05):
    return torch.optim.lr_scheduler.LambdaLR(opt, lambda it: lr_factor(it, total, warmup, final_frac))


def save_checkpoint(path, model, opt, sched, scaler, epoch, iteration, cfg, best_metric, extra=None):
    path = str(path); tmp = path + ".tmp"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    state = {"model": model.state_dict(), "optimizer": opt.state_dict(), "scheduler": sched.state_dict(),
             "scaler": scaler.state_dict(), "epoch": epoch, "iteration": iteration, "rng": get_rng_state(),
             "config": cfg, "config_hash": config_hash(cfg), "best_metric": best_metric, "extra": extra or {}}
    torch.save(state, tmp)
    ck = torch.load(tmp, map_location="cpu", weights_only=False)          # validate BEFORE replacing the old file
    missing = [k for k in REQUIRED if k not in ck]
    assert not missing, f"checkpoint missing keys: {missing}"
    assert ck["iteration"] == iteration and ck["config_hash"] == config_hash(cfg)
    os.replace(tmp, path)
    return os.path.getsize(path)


def load_checkpoint(path, model, opt=None, sched=None, scaler=None, cfg=None, restore_rng=True):
    ck = torch.load(path, map_location="cpu", weights_only=False)
    if cfg is not None and config_hash(cfg) != ck["config_hash"]:
        raise ValueError(f"config hash mismatch: checkpoint {ck['config_hash']} vs current {config_hash(cfg)}")
    model.load_state_dict(ck["model"])
    if opt is not None: opt.load_state_dict(ck["optimizer"])
    if sched is not None: sched.load_state_dict(ck["scheduler"])
    if scaler is not None: scaler.load_state_dict(ck["scaler"])
    if restore_rng: set_rng_state(ck["rng"])
    return ck
