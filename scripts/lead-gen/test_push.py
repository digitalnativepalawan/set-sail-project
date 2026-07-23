#!/usr/bin/env python
"""Self-test for the Supabase write/dedupe logic (no real Supabase needed).

Monkeypatches create_client with an in-memory fake so we can prove:
  - new leads get inserted
  - leads whose source_url already exists are skipped
  - missing env vars short-circuit safely
"""

import os
import sys

# Ensure we import the module under test from this folder.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import reddit_leadgen as rl  # noqa: E402
import supabase  # noqa: E402  (patch create_client here, not rl)


class FakeTable:
    def __init__(self, store):
        self._store = store
        self._pending = None

    def select(self, *_a, **_k):
        return self

    def insert(self, row):
        self._pending = row
        return self

    def execute(self):
        if self._pending is not None:
            self._store.append(dict(self._pending))
            self._pending = None
        return type("R", (), {"data": list(self._store)})()


class FakeClient:
    def __init__(self):
        self._rows = []
        self.table_calls = 0

    def table(self, name):
        self.table_calls += 1
        return FakeTable(self._rows)


def test_dedupe_and_insert():
    # Patch create_client BEFORE calling push_to_supabase.
    fake = FakeClient()
    supabase.create_client = lambda u, k: fake  # type: ignore[attr-defined]
    # Provide dummy env so the function proceeds to the (faked) client.
    os.environ["SUPABASE_URL"] = "https://example.supabase.co"
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "dummy-key"

    leads = [
        {"sub": "digitalnomad(search:palawan)", "title": "Trip to Palawan",
         "author": "alice", "permalink": "https://reddit.com/r/x/1",
         "selftext": "going to el nido", "updated": ""},
        {"sub": "digitalnomad(search:palawan)", "title": "Same link again",
         "author": "bob", "permalink": "https://reddit.com/r/x/1",
         "selftext": "dup", "updated": ""},
        {"sub": "digitalnomad(search:palawan)", "title": "New Coron lead",
         "author": "carol", "permalink": "https://reddit.com/r/x/2",
         "selftext": "coron stay", "updated": ""},
    ]
    inserted, skipped = rl.push_to_supabase(leads)
    assert inserted == 2, f"expected 2 inserted, got {inserted}"
    assert skipped == 1, f"expected 1 skipped, got {skipped}"
    assert len(fake._rows) == 2
    assert fake._rows[0]["source"] == "tala_leadgen"
    assert fake._rows[0]["source_url"] == "https://reddit.com/r/x/1"
    print("PASS: insert + dedupe logic correct "
          f"({inserted} inserted, {skipped} skipped)")


def test_missing_env():
    saved = (os.environ.pop("SUPABASE_URL", None),
             os.environ.pop("SUPABASE_SERVICE_ROLE_KEY", None))
    try:
        inserted, skipped = rl.push_to_supabase([{
            "sub": "s", "title": "t", "author": "a",
            "permalink": "https://reddit.com/r/x/9", "selftext": "x", "updated": "",
        }])
        assert inserted == 0 and skipped == 0
        print("PASS: missing env short-circuits safely (0 inserted)")
    finally:
        if saved[0]:
            os.environ["SUPABASE_URL"] = saved[0]
        if saved[1]:
            os.environ["SUPABASE_SERVICE_ROLE_KEY"] = saved[1]


if __name__ == "__main__":
    test_dedupe_and_insert()
    test_missing_env()
    print("\nALL TESTS PASSED")
