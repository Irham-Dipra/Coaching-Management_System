import time
from typing import Any, Dict, Optional

class FinanceCache:
    def __init__(self, ttl_seconds: int = 600):
        # Default TTL is 10 minutes
        self._cache: Dict[str, Dict[str, Any]] = {}
        self.ttl = ttl_seconds

    def get(self, key: str) -> Optional[Any]:
        if key in self._cache:
            item = self._cache[key]
            if time.time() - item['timestamp'] < self.ttl:
                return item['value']
            else:
                del self._cache[key]
        return None

    def set(self, key: str, value: Any):
        self._cache[key] = {
            'value': value,
            'timestamp': time.time()
        }

    def invalidate(self):
        """Clears all cached finance data. Should be called on NO-OP mutations."""
        print("Invalidating Finance Cache...")
        self._cache.clear()

finance_cache = FinanceCache()
