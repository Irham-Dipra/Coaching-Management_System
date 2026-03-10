"""
Finance Stats Cache — Cache-with-Explicit-Invalidation

The heavy due calculation runs once and is stored in memory.
Any mutation that changes revenue or dues explicitly calls invalidate_stats_cache()
so the next read recomputes fresh data.

This means:
  - Reads between mutations  → near-instant (cache hit, <10ms)
  - First read or post-mutation → full computation (2–5s), then cached
"""
from datetime import datetime

_cache: dict = {
    "quick": None,   # fast stats: student count, program count, revenue
    "dues": None,    # slow stats: total_due, due_this_month
    "quick_at": None,
    "dues_at": None,
    "lists": {},
}

# Separate TTLs — quick stats can be quite fresh (2 min), dues are heavier (5 min fallback)
QUICK_TTL_SECONDS = 120
DUES_TTL_SECONDS = 300


def get_cached_quick() -> dict | None:
    if _cache["quick"] and _cache["quick_at"]:
        age = (datetime.now() - _cache["quick_at"]).total_seconds()
        if age < QUICK_TTL_SECONDS:
            return _cache["quick"]
    return None


def set_cached_quick(data: dict):
    _cache["quick"] = data
    _cache["quick_at"] = datetime.now()


def get_cached_dues() -> dict | None:
    if _cache["dues"] and _cache["dues_at"]:
        age = (datetime.now() - _cache["dues_at"]).total_seconds()
        if age < DUES_TTL_SECONDS:
            return _cache["dues"]
    return None


def set_cached_dues(data: dict):
    _cache["dues"] = data
    _cache["dues_at"] = datetime.now()


def get_cached_list(key: str) -> dict | None:
    if key in _cache["lists"]:
        data, cached_at = _cache["lists"][key]
        if (datetime.now() - cached_at).total_seconds() < DUES_TTL_SECONDS:
            return data
    return None


def set_cached_list(key: str, data: dict):
    _cache["lists"][key] = (data, datetime.now())


def invalidate_stats_cache():
    """
    Call this after ANY mutation that changes revenue or dues:
    - Payment created / updated / deleted
    - Enrollment created / deleted / fee changed
    - Student deleted
    - Program deleted
    """
    _cache["quick"] = None
    _cache["quick_at"] = None
    _cache["dues"] = None
    _cache["dues_at"] = None
    _cache["lists"].clear()
