"""
Students List Cache — Cache-with-Explicit-Invalidation

The paginated student query (3-level join: student → enrollment → program)
runs once per unique parameter set, then is stored in memory.

Any mutation that changes student data or enrollment data calls
invalidate_students_cache() so the next read goes fresh to Supabase.

TTL (60s) acts as a safety net against missed invalidations or
multi-worker deployments where in-memory state is not shared.
"""
from datetime import datetime

# { (page, page_size, search, roll_search, class, batch_id, program_id): {"data": ..., "at": datetime} }
_cache: dict = {}

TTL_SECONDS = 60


def make_key(page: int, page_size: int, search: str, roll_search: str, filters: dict) -> tuple:
    """Build a hashable cache key from all query parameters."""
    return (
        page,
        page_size,
        search or "",
        roll_search or "",
        (filters.get("class") if filters else None),
        (filters.get("batch_id") if filters else None),
        (filters.get("program_id") if filters else None),
    )


def get_cached_students(key: tuple) -> dict | None:
    """Return cached result for this key if still fresh, else None."""
    entry = _cache.get(key)
    if entry:
        age = (datetime.now() - entry["at"]).total_seconds()
        if age < TTL_SECONDS:
            return entry["data"]
        # Expired — evict this stale entry
        del _cache[key]
    return None


def set_cached_students(key: tuple, data: dict):
    """Store a fresh result in the cache."""
    _cache[key] = {"data": data, "at": datetime.now()}


def invalidate_students_cache():
    """
    Clear ALL cached student pages. Call this after any mutation that
    affects the student list or embedded enrollment data:
    - Student created / updated / deleted
    - Enrollment created / deleted (affects program+roll badges in the list)
    - Bulk student import
    """
    _cache.clear()
