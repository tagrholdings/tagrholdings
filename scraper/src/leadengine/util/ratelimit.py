from __future__ import annotations

import random
import time
from collections.abc import Callable


class DomainThrottle:
    """Spaces requests to the same host at least `min_interval` seconds apart (plus jitter).

    Politeness, not just performance: the engine may hit a small business's
    website or a marketplace, and must never hammer either.
    """

    def __init__(
        self,
        min_interval: float = 1.5,
        jitter: float = 0.5,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self.min_interval = min_interval
        self.jitter = jitter
        self._clock = clock
        self._sleep = sleep
        self._last: dict[str, float] = {}

    def wait(self, host: str) -> None:
        now = self._clock()
        last = self._last.get(host)
        if last is not None:
            delay = self.min_interval + random.uniform(0, self.jitter) - (now - last)
            if delay > 0:
                self._sleep(delay)
        self._last[host] = self._clock()
