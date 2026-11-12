"""lr_pilot.py - one LR-pilot candidate. Trains on the train split, evaluates on the VALIDATION split only."""
import os, json, time, csv, math, hashlib, gc
from pathlib import Path
import numpy as np, torch
from torch.utils.data import DataLoader
from transformers.utils import logging as hf_logging
hf_logging.set_verbosity_error(); hf_logging.disable_progress_bar()
import mars_common as mc, mars_det as md, ckpt_utils as cu, tracking as tk

CN = ["soil", "bedrock", "sand", "bigrock"]
MIOU3_TOL = 1e-9    # float tolerance: 0.80 - 0.75 evaluates to 0.05000000000000004 and must NOT count as a drop above 0.05


def miou3_rejections(evals, pairs, threshold):
    """evals: {iteration: validation mIoU3}. pairs: [[earlier_iter, later_iter], ...] named in the protocol.
    Returns one record per pair whose mIoU3 fell by strictly more than `threshold`. Pairs not listed are never checked."""
    out = []
    for a, b in pairs:
        if a in evals and b in evals:
            drop = evals[a] - evals[b]
            if drop > threshold + MIOU3_TOL:
                out.append(dict(rule="miou3_drop", pair=[a, b], miou3_from=evals[a], miou3_to=evals[b],
                                drop=drop, threshold=threshold))
    return out


def state_hash(sd):
    h = hashlib.sha256()
    for k in sorted(sd):
        t = sd[k].detach().cpu().contiguous()
        h.update(k.encode()); h.update(str(t.dtype).encode()); h.update(str(tuple(t.shape)).encode())
        h.update(t.numpy().tobytes())
    return h.hexdigest()


def truncate_csv(path, it_max):
    path = Path(path)
    if not path.exists(): return 0
    rows = list(csv.reader(open(path))); head, body = rows[0], rows[1:]
    k = head.index("iteration")
    keep = [r for r in body if int(float(r[k])) <= it_max]
    with open(path, "w", newline="") as f:
        w = csv.writer(f); w.writerow(head); w.writerows(keep)
    return len(body) - len(keep)


def tag_for(lr):
    return f"lr{lr:.0e}"


def run_candidate(cfg, lr, tag, root, init_path, use_wandb=True, wandb_group="lr_pilot",
                  eval_max_batches=None, log_every=25, ckpt_every=0, stop_after=None, resume=True):
    root = Path(root)
    seed, bs, total = cfg["seed"], cfg["batch_size"], cfg["total_iters"]
    eval_iters = set(cfg["eval_iters"]); ccfg = {**cfg, "lr": lr}; chash = cu.config_hash(ccfg)
    pairs, thr = cfg["reject_miou3_pairs"], cfg["reject_miou3_drop"]
    torch.backends.cudnn.deterministic = cfg["cudnn_deterministic"]; torch.backends.cudnn.benchmark = cfg["cudnn_benchmark"]
    n = len(mc.MarsSeg("train")); spe = n // bs
    assert spe == cfg["steps_per_epoch"], "steps per epoch differs from protocol"
    assert md.plan_hash(seed, bs, n, total) == cfg["plan_hash"], "data-stream plan differs from the protocol"

    init = torch.load(init_path, map_location="cpu", weights_only=True)
    assert init["state_hash"] == cfg["init_state_hash"], "initial-weights file differs from the protocol"
    mc.set_seed(seed); model = mc.new_model(); model.load_state_dict(init["state_dict"])
    assert state_hash(model.state_dict()) == cfg["init_state_hash"], "model did not load the shared initial weights"
    mc.set_seed(seed)                                   # identical dropout stream for every candidate

    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=cfg["weight_decay"])
    sched = cu.make_scheduler(opt, total, cfg["warmup"], cfg["final_frac"])
    scaler = torch.amp.GradScaler(mc.DEV, enabled=mc.USE_AMP)

    prefix = root / "logs" / "lr_pilot" / tag; res_dir = root / "results" / "lr_pilot"
    ck_path = root / "checkpoints" / "lr_pilot" / tag / "last.pt"
    prefix.parent.mkdir(parents=True, exist_ok=True); res_dir.mkdir(parents=True, exist_ok=True)
    it0, best, skipped, resumed_from, truncated = 0, -1.0, 0, None, 0
    if resume and ck_path.exists():
        ck = cu.load_checkpoint(ck_path, model, opt, sched, scaler, cfg=ccfg)
        it0, best, skipped = ck["iteration"], ck["best_metric"], ck["extra"].get("skipped", 0)
        truncated = sum(truncate_csv(f"{prefix}_{k}.csv", it0) for k in ("train", "val"))
        resumed_from = it0
        print(f"[{tag}] RESUMED from iteration {it0} (removed {truncated} CSV rows newer than the checkpoint)")
    if it0 == 0:                                        # fresh start: stale CSVs from a crashed earlier attempt must not survive
        for k in ("train", "val"): Path(f"{prefix}_{k}.csv").unlink(missing_ok=True)

    evals = {}                                          # {iteration: val mIoU3}, rebuilt from the (truncated) CSV on resume
    vp0 = Path(f"{prefix}_val.csv")
    if vp0.exists():
        for r in csv.DictReader(open(vp0)): evals[int(float(r["iteration"]))] = float(r["miou3"])
    n_reported = len(miou3_rejections(evals, pairs, thr)); fatal = []
    print(f"[{tag}] lr={lr:g} | config hash {chash} | init hash {cfg['init_state_hash'][:12]} | plan hash {cfg['plan_hash'][:12]} | start iteration {it0}", flush=True)

    tr = tk.Tracker(prefix, project="mars-compression", name=tag, group=wandb_group, config=ccfg, use_wandb=use_wandb)
    loader = md.make_det_loader(seed, bs, it0, total, workers=cfg["workers"], flip=True)
    val_loader = DataLoader(mc.MarsSeg("val"), batch_size=16, shuffle=False, num_workers=2, pin_memory=True)

    def save(it):
        cu.save_checkpoint(ck_path, model, opt, sched, scaler, it // spe, it, ccfg, best, extra={"skipped": skipped, "tag": tag})

    status, it, win_loss, win_gn, t0 = "completed", it0, [], [], time.time()
    for x, y in loader:
        lr_used = opt.param_groups[0]["lr"]
        loss, gn = mc.train_step(model, opt, scaler, x, y); sched.step(); it += 1
        if not math.isfinite(loss):
            status = "REJECT_NONFINITE_TRAIN_LOSS"; fatal.append(dict(rule="non-finite training loss", iteration=it))
            tr.log("train", dict(iteration=it, epoch=it / spe, loss=float("nan"), lr=lr_used, grad_norm=float("nan"),
                                 skipped_steps_total=skipped, elapsed_s=time.time() - t0), step=it)
            break
        win_loss.append(loss)
        if math.isfinite(gn): win_gn.append(gn)
        else: skipped += 1                              # fp16 overflow: GradScaler skipped this optimiser step
        if it % log_every == 0:
            tr.log("train", dict(iteration=it, epoch=it / spe, loss=float(np.mean(win_loss)), lr=lr_used,
                                 grad_norm=float(np.mean(win_gn)) if win_gn else float("nan"),
                                 skipped_steps_total=skipped, elapsed_s=time.time() - t0), step=it)
            win_loss, win_gn = [], []
        if it in eval_iters:
            te = time.time(); ev = mc.evaluate(model, val_loader, max_batches=eval_max_batches)
            row = dict(iteration=it, epoch=it / spe, val_loss=ev["loss"], miou4=ev["miou4"], miou3=ev["miou3"], pixacc=ev["pixacc"])
            for k, nm in enumerate(CN):
                row[f"iou_{nm}"], row[f"recall_{nm}"], row[f"precision_{nm}"] = ev["iou"][k], ev["recall"][k], ev["precision"][k]
            row["eval_s"] = time.time() - te
            tr.log("val", row, step=it)
            json.dump({"tag": tag, "lr": lr, "iteration": it, **ev}, open(res_dir / f"{tag}_val_it{it}.json", "w"), indent=1)
            best = max(best, ev["miou4"]); save(it)
            evals[it] = ev["miou3"]
            now = miou3_rejections(evals, pairs, thr)
            for r in now[n_reported:]:
                print(f"[{tag}] REJECTION RULE TRIGGERED: val mIoU3 fell {r['miou3_from']:.4f} -> {r['miou3_to']:.4f} "
                      f"(drop {r['drop']:.4f} > {thr}) between iterations {r['pair'][0]} and {r['pair'][1]}. "
                      f"Candidate is marked rejected; training continues so the full curve is recorded.", flush=True)
            n_reported = len(now)
            if not math.isfinite(ev["loss"]):
                status = "REJECT_NONFINITE_VAL_LOSS"; fatal.append(dict(rule="non-finite validation loss", iteration=it)); break
        elif ckpt_every and it % ckpt_every == 0:
            save(it)
        if stop_after is not None and it >= stop_after:
            status = "STOPPED_EARLY"; break
    tr.finish()
    vp = Path(f"{prefix}_val.csv")
    val_rows = list(csv.DictReader(open(vp))) if vp.exists() else []
    reasons = fatal + miou3_rejections(evals, pairs, thr)
    summary = dict(tag=tag, lr=lr, status=status, rejected=bool(reasons), reject_reasons=reasons,
                   miou3_rule=dict(pairs=pairs, threshold=thr, strictly_greater=True, tolerance=MIOU3_TOL),
                   iterations_done=it, config_hash=chash, plan_hash=cfg["plan_hash"],
                   init_state_hash=cfg["init_state_hash"], resumed_from=resumed_from, csv_rows_truncated=truncated,
                   skipped_steps_total=skipped, wandb_connected=tr.run is not None, wandb_errors=tr.wb_errors,
                   train_time_s=time.time() - t0, val=val_rows)
    json.dump(summary, open(res_dir / f"{tag}_summary.json", "w"), indent=1)
    del loader, val_loader, model, opt, sched, scaler; gc.collect(); torch.cuda.empty_cache()
    return summary
