from __future__ import annotations

import asyncio
import json
import logging
import random
import threading
import time
from dataclasses import dataclass, field
from typing import Any

import websockets
from websockets.exceptions import ConnectionClosed, InvalidHandshake

from worker.workloads import WORKLOADS, ComputeCancelled

VERSION = "1.0.0"
log = logging.getLogger("vampire.node")


class FatalServerError(Exception):
    pass


@dataclass
class Config:
    url: str
    wallet: str
    name: str
    node_id: str
    base_backoff: float = 1.0
    max_backoff: float = 30.0
    ping_interval: float = 15.0
    ping_timeout: float = 20.0
    open_timeout: float = 10.0


@dataclass
class _SessionState:
    current_id: str | None = None
    cancel: threading.Event | None = None
    cancelled: set[str] = field(default_factory=set)

    def cancel_current(self) -> None:
        if self.cancel is not None:
            self.cancel.set()


class Worker:
    def __init__(self, cfg: Config) -> None:
        self.cfg = cfg
        self._attempt = 0
        self.completed = 0
        self.earned = 0.0

    async def run_forever(self) -> None:
        while True:
            try:
                log.info("Connecting to %s", self.cfg.url)
                async with websockets.connect(
                    self.cfg.url,
                    ping_interval=self.cfg.ping_interval,
                    ping_timeout=self.cfg.ping_timeout,
                    max_size=1_048_576,
                    open_timeout=self.cfg.open_timeout,
                ) as ws:
                    await self._session(ws)
                log.warning("Connection closed by master")
            except FatalServerError as exc:
                log.error("Fatal: %s — not reconnecting", exc)
                return
            except (KeyboardInterrupt, asyncio.CancelledError):
                log.info("Worker stopped by user")
                return
            except (TimeoutError, OSError, ConnectionClosed, InvalidHandshake) as exc:
                log.warning("Connection lost (%s: %s)", type(exc).__name__, exc)
            except Exception as exc:  # noqa: BLE001
                log.warning("Unexpected connection error: %s", exc)

            delay = self._backoff_delay()
            log.info("Reconnecting in %.1fs (attempt %d)", delay, self._attempt)
            try:
                await asyncio.sleep(delay)
            except (KeyboardInterrupt, asyncio.CancelledError):
                log.info("Worker sleep interrupted — exiting")
                return

    def _backoff_delay(self) -> float:
        ceiling = min(self.cfg.max_backoff, self.cfg.base_backoff * (2 ** min(self._attempt, 16)))
        self._attempt += 1
        return random.uniform(ceiling / 2, ceiling)

    async def _session(self, ws: Any) -> None:
        await ws.send(json.dumps({
            "type": "register",
            "nodeId": self.cfg.node_id,
            "wallet": self.cfg.wallet,
            "name": self.cfg.name,
            "version": VERSION,
        }))
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        state = _SessionState()
        compute = asyncio.create_task(self._compute_loop(ws, queue, state))
        try:
            async for raw in ws:
                await self._on_message(raw, queue, state)
                if compute.done():
                    compute.result()
        finally:
            state.cancel_current()
            compute.cancel()
            await asyncio.gather(compute, return_exceptions=True)

    async def _on_message(self, raw: Any, queue: asyncio.Queue[dict[str, Any]], state: _SessionState) -> None:
        try:
            msg: dict[str, Any] = json.loads(raw)
        except (TypeError, ValueError):
            log.warning("Ignoring non-JSON frame")
            return

        if not isinstance(msg, dict):
            return

        kind = str(msg.get("type") or "")

        if kind == "registered":
            self._attempt = 0
            log.info("Registered as %s", msg.get("nodeId"))
        elif kind == "task":
            await queue.put(msg)
        elif kind == "cancel":
            tid = str(msg.get("taskId") or "")
            if tid == state.current_id:
                log.info("Cancelled: %s (%s)", tid, msg.get("reason"))
                state.cancel_current()
            else:
                state.cancelled.add(tid)
        elif kind == "ack":
            if msg.get("accepted"):
                self.completed += 1
                try:
                    reward = float(msg.get("reward", 0))
                except (TypeError, ValueError):
                    reward = 0.0
                self.earned += reward
                log.info("✔ %s +%s VAMP (balance %s, session %.0f)", msg.get("taskId"), reward, msg.get("balance"), self.earned)
            else:
                log.warning("✘ %s rejected: %s", msg.get("taskId"), msg.get("reason"))
        elif kind == "error":
            log.error("Master error [%s]: %s", msg.get("code"), msg.get("message"))
            if msg.get("fatal"):
                raise FatalServerError(str(msg.get("message") or "fatal error"))

    async def _compute_loop(self, ws: Any, queue: asyncio.Queue[dict[str, Any]], state: _SessionState) -> None:
        while True:
            task = await queue.get()
            if not isinstance(task, dict):
                continue
            task_id: str = str(task.get("taskId") or "")

            if not task_id or task_id in state.cancelled:
                state.cancelled.discard(task_id)
                continue

            workload_name = str(task.get("workload") or "")
            fn = WORKLOADS.get(workload_name)
            if fn is None:
                await self._send(ws, {"type": "failed", "taskId": task_id, "error": f"unsupported workload {workload_name!r}"})
                continue

            payload = task.get("payload")
            if not isinstance(payload, dict):
                payload = {}

            state.current_id = task_id
            state.cancel = threading.Event()
            started = time.monotonic()
            log.info("▶  %s", task_id)

            try:
                output: dict[str, Any] = await asyncio.to_thread(fn, payload, state.cancel)
            except ComputeCancelled:
                log.info("■  %s cancelled (%.1fs)", task_id, time.monotonic() - started)
                continue
            except Exception as exc:
                log.exception("Workload crashed on %s", task_id)
                await self._send(ws, {"type": "failed", "taskId": task_id, "error": repr(exc)})
                continue
            finally:
                state.current_id = None
                state.cancel = None

            if not isinstance(output, dict):
                output = {"result": output}

            output["elapsedSec"] = round(time.monotonic() - started, 3)
            log.info("◆  %s solved in %.2fs", task_id, output["elapsedSec"])
            await self._send(ws, {"type": "result", "taskId": task_id, "output": output})

    @staticmethod
    async def _send(ws: Any, obj: dict[str, Any]) -> None:
        try:
            await ws.send(json.dumps(obj))
        except (ConnectionClosed, OSError):
            log.warning("Could not send %s: connection closed", obj.get("type"))
