"""tracking.py - local CSV first, W&B second. W&B problems never stop training.
Only scalar metrics and a small config go to W&B (no code, models, files or console output)."""
import os, csv
from pathlib import Path


class Tracker:
    def __init__(self, csv_prefix, project=None, name=None, group=None, config=None, use_wandb=True):
        self.prefix = Path(csv_prefix); self.prefix.parent.mkdir(parents=True, exist_ok=True)
        self.fields, self.run, self.wb_errors = {}, None, 0
        if use_wandb:
            try:
                os.environ["WANDB_DISABLE_CODE"] = "true"; os.environ["WANDB_CONSOLE"] = "off"
                import wandb
                try:
                    from kaggle_secrets import UserSecretsClient
                    wandb.login(key=UserSecretsClient().get_secret("WANDB_API_KEY"))
                except Exception as e:
                    print("  (Kaggle secret not used:", type(e).__name__, ")")
                self.run = wandb.init(project=project, name=name, group=group, config=config, save_code=False)
            except Exception as e:
                print("W&B unavailable; continuing with local CSV only:", repr(e)[:200]); self.run = None

    def _wb_log(self, data, step):
        self.run.log(data, step=step)

    def log(self, kind, row, step=None):
        path = Path(f"{self.prefix}_{kind}.csv")                       # 1) local CSV, always first
        if kind not in self.fields:
            self.fields[kind] = list(row.keys())
            if not path.exists():
                with open(path, "w", newline="") as f: csv.writer(f).writerow(self.fields[kind])
        with open(path, "a", newline="") as f:
            csv.DictWriter(f, fieldnames=self.fields[kind], extrasaction="ignore").writerow(row)
        if self.run is not None:                                       # 2) W&B, never allowed to raise
            try:
                self._wb_log({f"{kind}/{k}": v for k, v in row.items() if isinstance(v, (int, float))}, step)
            except Exception as e:
                self.wb_errors += 1
                if self.wb_errors <= 3: print("  W&B log failed (training continues):", repr(e)[:120])

    def finish(self):
        if self.run is not None:
            try: self.run.finish()
            except Exception as e: print("W&B finish failed:", repr(e)[:120])
