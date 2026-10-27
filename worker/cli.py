from __future__ import annotations

import argparse
import asyncio
import logging
import os
import platform
import secrets
import signal
import uuid

from worker.node import Config, Worker

log = logging.getLogger("vampire.node")


def build_config(args: argparse.Namespace) -> Config:
    wallet = args.wallet or ("0x" + secrets.token_hex(20))
    if not args.wallet:
        log.warning("No --wallet given; using throwaway address %s", wallet)
    return Config(
        url=args.url,
        wallet=wallet,
        name=args.name[:32],
        node_id=uuid.uuid4().hex,
        base_backoff=args.base_backoff,
        max_backoff=args.max_backoff,
    )


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(prog="python -m worker", description="Vampire Cloud worker node")
    p.add_argument("--url",          default=os.getenv("VAMP_MASTER_URL", "ws://localhost:8080/worker"))
    p.add_argument("--wallet",       default=os.getenv("VAMP_WALLET", ""))
    p.add_argument("--name",         default=os.getenv("VAMP_NODE_NAME", platform.node() or "worker"))
    p.add_argument("--base-backoff", type=float, default=1.0)
    p.add_argument("--max-backoff",  type=float, default=30.0)
    p.add_argument("-v", "--verbose", action="store_true")
    return p.parse_args()


async def _amain(cfg: Config) -> None:
    worker = Worker(cfg)
    main_task = asyncio.current_task()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            if main_task is not None:
                loop.add_signal_handler(sig, main_task.cancel)
        except (NotImplementedError, RuntimeError):
            pass
    try:
        await worker.run_forever()
    except asyncio.CancelledError:
        log.info("Shutdown — %d tasks completed, %.0f VAMP earned", worker.completed, worker.earned)


def main() -> None:
    args = _parse_args()
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s — %(message)s",
        datefmt="%H:%M:%S",
    )
    try:
        asyncio.run(_amain(build_config(args)))
    except KeyboardInterrupt:
        pass
