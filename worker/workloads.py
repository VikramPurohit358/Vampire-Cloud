from __future__ import annotations

import hashlib
import threading
from collections.abc import Callable
from typing import Any

__all__ = ["WORKLOADS", "ComputeCancelled", "Workload", "workload"]


class ComputeCancelled(Exception):
    pass


Workload = Callable[[dict[str, Any], threading.Event], dict[str, Any]]
WORKLOADS: dict[str, Workload] = {}

_CANCEL_CHECK_EVERY = 20_000


def workload(name: str) -> Callable[[Workload], Workload]:
    def _register(fn: Workload) -> Workload:
        WORKLOADS[name] = fn
        return fn
    return _register


@workload("sha256_pow")
def sha256_pow(payload: dict[str, Any], cancel: threading.Event) -> dict[str, Any]:
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
