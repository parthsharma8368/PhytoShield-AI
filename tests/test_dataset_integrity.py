"""Guards against train/val/test data leakage in the saved split manifests."""

import hashlib
import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _hashes(split: str) -> set[str]:
    manifest = json.loads((DATA_DIR / f"{split}_split.json").read_text(encoding="utf-8"))
    return {hashlib.md5(Path(p).read_bytes()).hexdigest() for paths in manifest.values() for p in paths}


def test_no_image_shared_between_splits() -> None:
    train, val, test = _hashes("train"), _hashes("val"), _hashes("test")
    assert not train & test, "images shared by train and test"
    assert not train & val, "images shared by train and val"
    assert not val & test, "images shared by val and test"
