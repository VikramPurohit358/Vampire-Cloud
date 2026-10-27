from __future__ import annotations

import hashlib
import threading
from typing import Any, Callable, Dict

__all__ = ["ComputeCancelled", "Workload", "WORKLOADS", "workload"]


class ComputeCancelled(Exception):
    pass


Workload = Callable[[Dict[str, Any], threading.Event], Dict[str, Any]]
WORKLOADS: Dict[str, Workload] = {}

_CANCEL_CHECK_EVERY = 20_000


def workload(name: str) -> Callable[[Workload], Workload]:
    def _register(fn: Workload) -> Workload:
        WORKLOADS[name] = fn
        return fn
    return _register


@workload("sha256_pow")
def sha256_pow(payload: Dict[str, Any], cancel: threading.Event) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        payload = {}
    data: str = str(payload.get("data", ""))
    try:
        difficulty: int = max(1, min(64, int(payload.get("difficulty", 1))))
    except (TypeError, ValueError):
        difficulty = 1

    target = "0" * difficulty
    prefix = hashlib.sha256(data.encode("utf-8"))
    nonce = 0
    while True:
        if nonce % _CANCEL_CHECK_EVERY == 0 and cancel.is_set():
            raise ComputeCancelled()
        h = prefix.copy()
        h.update(str(nonce).encode("ascii"))
        digest = h.hexdigest()
        if digest.startswith(target):
            return {"nonce": nonce, "hash": digest, "hashes": nonce + 1}
        nonce += 1
