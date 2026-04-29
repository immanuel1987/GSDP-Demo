"""
Default dashboard module access per logical role key — keep in sync with frontend `ROLE_PAGES` / `ROLE_EXTRA_ROUTES`.
"""

from __future__ import annotations

import re
from typing import Dict, List, Set

# Mirror frontend `src/data/dashboardNav.js` (ROLE_PAGES + ROLE_EXTRA_ROUTES).
ROLE_PAGES: Dict[str, List[str]] = {
    "public": ["dashboard", "resources", "collections", "institutions", "networks", "events"],
    "registered": [
        "dashboard",
        "resources",
        "collections",
        "institutions",
        "networks",
        "events",
        "persons",
        "ai",
    ],
    "liaison": [
        "dashboard",
        "resources",
        "collections",
        "institutions",
        "networks",
        "events",
        "persons",
        "ai",
        "owl",
    ],
    "editor": [
        "dashboard",
        "resources",
        "collections",
        "institutions",
        "networks",
        "events",
        "persons",
        "ai",
        "owl",
        "analytics",
    ],
    "admin": [
        "dashboard",
        "resources",
        "collections",
        "institutions",
        "networks",
        "events",
        "persons",
        "ai",
        "owl",
        "analytics",
        "governance",
        "access",
    ],
    "rector_major": [
        "dashboard",
        "resources",
        "collections",
        "institutions",
        "networks",
        "events",
        "persons",
        "ai",
        "owl",
        "analytics",
        "governance",
        "access",
    ],
    "provincial": [
        "dashboard",
        "resources",
        "collections",
        "institutions",
        "networks",
        "events",
        "persons",
        "ai",
        "analytics",
    ],
    "viewer": [
        "dashboard",
        "resources",
        "collections",
        "institutions",
        "networks",
        "events",
        "persons",
        "ai",
    ],
}

ROLE_EXTRA_ROUTES: Dict[str, List[str]] = {
    "liaison": ["analytics"],
}

KNOWN_PAGE_IDS: Set[str] = set()
for _pages in ROLE_PAGES.values():
    KNOWN_PAGE_IDS.update(_pages)
for _extra in ROLE_EXTRA_ROUTES.values():
    KNOWN_PAGE_IDS.update(_extra)


def role_key_from_role_name(role_name: str) -> str:
    raw = (role_name or "").strip().lower()
    if not raw:
        return "registered"
    if "rector" in raw and "major" in raw:
        return "rector_major"
    if "provincial" in raw:
        return "provincial"
    title = (role_name or "").strip()
    if re.search(r"\bviewer\b", title, flags=re.IGNORECASE):
        return "viewer"
    if raw == "admin" or "administrator" in raw:
        return "admin"
    if "editor" in raw:
        return "editor"
    if "liaison" in raw:
        return "liaison"
    return "registered"


def default_allowed_pages_for_role_name(role_name: str) -> List[str]:
    key = role_key_from_role_name(role_name)
    base = list(ROLE_PAGES.get(key) or ROLE_PAGES["registered"])
    extra = list(ROLE_EXTRA_ROUTES.get(key) or [])
    seen: Set[str] = set()
    out: List[str] = []
    for p in base + extra:
        if p not in seen:
            seen.add(p)
            out.append(p)
    return out


def validate_allowed_pages(pages: List[str]) -> List[str]:
    if not isinstance(pages, list):
        raise ValueError("allowed_pages must be a list")
    out: List[str] = []
    for p in pages:
        s = str(p).strip()
        if not s:
            continue
        if s not in KNOWN_PAGE_IDS:
            raise ValueError(f"Unknown page id: {s}")
        out.append(s)
    if "dashboard" not in out:
        out = ["dashboard"] + out
    seen: Set[str] = set()
    deduped: List[str] = []
    for p in out:
        if p not in seen:
            seen.add(p)
            deduped.append(p)
    return deduped
