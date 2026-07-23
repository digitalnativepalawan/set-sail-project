#!/usr/bin/env python
"""
TALA Lead-Gen — Reddit scraper (dry run by default).

Pulls posts from nomad subreddits via Reddit's public RSS (fetched with
Scrapling's StealthyFetcher so Reddit's script-blocking doesn't kill it),
filters for Philippines / Palawan / long-stay intent, and prints candidate
leads. With --write, dedupes by source_url and inserts new leads into the
Supabase `tala_leads` table (source = 'tala_leadgen').

Env (set in scripts/lead-gen/.env, or your shell):
    SUPABASE_URL            e.g. https://XXXX.supabase.co
    SUPABASE_SERVICE_ROLE_KEY  (service_role — needs INSERT on tala_leads)

Usage:
    .venv/Scripts/python reddit_leadgen.py            # dry run, print leads
    .venv/Scripts/python reddit_leadgen.py --write    # push new leads to Supabase
"""

import argparse
import os
import re
import sys
import time
from datetime import datetime, timezone

from dotenv import load_dotenv
from scrapling.fetchers import StealthyFetcher

load_dotenv()  # reads scripts/lead-gen/.env if present

# Keyword searches that directly surface intent (people asking about PH).
# These are higher-intent than scraping /hot and are the reliable fetch path.
SEARCH_QUERIES = [
    "palawan",
    "philippines stay",
    "philippines digital nomad",
    "where to stay philippines",
    "el nido",
    "coron philippines",
]

# Keyword searches that directly surface intent (people asking about PH).
# These are higher-intent than scraping /hot and are the reliable fetch path.
SEARCH_QUERIES = [
    "palawan",
    "philippines stay",
    "philippines digital nomad",
    "where to stay philippines",
    "el nido",
    "coron philippines",
]

# Words that signal someone is actually planning a trip/stay (high intent).
HIGH_INTENT = [
    "palawan", "el nido", "coron", "puerto princesa", "philippines", "philippine",
    "stay in", "staying in", "moving to", "spend a month", "spend a few weeks",
    "long stay", "long-term", "long term", "slow travel", "base myself",
    "work from", "co-working", "coworking", "visa", "where to stay",
    "recommend", "looking for", "planning a trip", "itinerary",
]

# Softer words that still flag relevance but lower the score.
SOFT_INTENT = [
    "digital nomad", "remote", "wifi", "beach", "island", "southeast asia",
    "se asia", "asia", "retire", "relocate", "travel",
]


def score_post(title: str, body: str) -> tuple[int, list[str]]:
    """Return (score, matched_keywords). Higher = hotter lead."""
    text = f"{title}\n{body}".lower()
    score = 0
    hits: list[str] = []
    for kw in HIGH_INTENT:
        if kw in text:
            score += 3
            hits.append(kw)
    for kw in SOFT_INTENT:
        if kw in text:
            score += 1
            hits.append(kw)
    return score, hits


def fetch_feed(url: str) -> list[dict]:
    """Fetch a Reddit RSS URL with the stealth browser and parse entries."""
    try:
        page = StealthyFetcher.fetch(
            url, headless=True, solve_cloudflare=True, timeout=90
        )
    except Exception as e:
        print(f"  ! fetch failed: {e}", file=sys.stderr)
        return []

    entries = page.xpath("//entry")
    out = []
    for e in entries:
        title = (e.css("title::text").get() or "").strip()
        content = (e.css("content::text").get() or "").strip()[:600]
        author = (e.css("author name::text").get() or "").strip()
        permalink = (e.css("link::attr(href)").get() or "").strip()
        # Normalize to a clean https://reddit.com/... URL (RSS may give old.reddit).
        m = re.search(r"reddit\.com(/r/[^?\s]+)", permalink)
        if m:
            permalink = "https://reddit.com" + m.group(1)
        updated = (e.css("updated::text").get() or "").strip()
        # Strip Reddit's HTML wrapper noise from the excerpt.
        clean = re.sub(r"<[^>]+>", " ", content)
        clean = re.sub(r"\s+", " ", clean).strip()
        out.append({
            "title": title,
            "selftext": clean,
            "author": author,
            "permalink": permalink,
            "updated": updated,
        })
    return out


def push_to_supabase(leads: list[dict]) -> tuple[int, int]:
    """Insert new leads into tala_leads, skipping known source_urls.

    Returns (inserted, skipped). Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
    """
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("  ! SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — cannot write.",
              file=sys.stderr)
        return (0, 0)

    from supabase import create_client
    sb = create_client(url, key)

    # Load existing source_urls we've already captured.
    existing: set[str] = set()
    try:
        resp = sb.table("tala_leads").select("source_url").execute()
        for row in (resp.data or []):
            if row.get("source_url"):
                existing.add(row["source_url"])
    except Exception as e:
        print(f"  ! dedupe read failed: {e}", file=sys.stderr)

    inserted = 0
    skipped = 0
    for p in leads:
        if not p["permalink"] or p["permalink"] in existing:
            skipped += 1
            continue
        note = f"[r/{p['sub']}] {p['title']}\n\n{p['selftext']}".strip()
        row = {
            "name": f"Reddit: {p['author'] or 'unknown'}",
            "contact": p["permalink"],
            "note": note[:2000],
            "source": "tala_leadgen",
            "source_url": p["permalink"],
        }
        try:
            sb.table("tala_leads").insert(row).execute()
            inserted += 1
            existing.add(p["permalink"])
        except Exception as e:
            print(f"  ! insert failed for {p['permalink']}: {e}", file=sys.stderr)
    return (inserted, skipped)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=25)
    ap.add_argument("--min-score", type=int, default=3,
                    help="Only show posts scoring at least this")
    ap.add_argument("--write", action="store_true",
                    help="Push new leads to Supabase tala_leads")
    args = ap.parse_args()

    raw: list[dict] = []
    for q in SEARCH_QUERIES:
        url = (f"https://old.reddit.com/r/digitalnomad/search.rss"
               f"?q={q.replace(' ', '+')}&limit={args.limit}&restrict_sr=1")
        posts = fetch_feed(url)
        for p in posts:
            p["sub"] = f"digitalnomad(search:{q})"
        raw.extend(posts)
        print(f"  searched '{q}': {len(posts)} posts", file=sys.stderr)
        time.sleep(3)

    # De-dupe by permalink.
    seen = set()
    leads = []
    for p in raw:
        key = p["permalink"]
        if not key or key in seen:
            continue
        seen.add(key)
        score, hits = score_post(p["title"], p["selftext"])
        if score >= args.min_score:
            p["score_intent"] = score
            p["hits"] = hits
            leads.append(p)

    leads.sort(key=lambda x: x["score_intent"], reverse=True)

    print(f"\n=== TALA LEAD-GEN {'WRITE' if args.write else 'DRY RUN'} — "
          f"{len(leads)} candidate leads from {len(raw)} posts scanned ===\n")
    for p in leads:
        age = ""
        if p["updated"]:
            try:
                dt = datetime.fromisoformat(p["updated"].replace("Z", "+00:00"))
                age = dt.strftime("%Y-%m-%d")
            except Exception:
                pass
        print(f"[{p['score_intent']:>2}] r/{p['sub']}  ({age})")
        print(f"    {p['title']}")
        if p["permalink"]:
            print(f"    {p['permalink']}")
        if p["selftext"].strip():
            print(f"    excerpt: {p['selftext'][:160].replace(chr(10), ' ')}...")
        print(f"    matched: {', '.join(p['hits'])}")
        print()

    if args.write:
        inserted, skipped = push_to_supabase(leads)
        print(f"WROTE — inserted {inserted} new lead(s), skipped {skipped} "
              f"already-captured.")
    else:
        print("DRY RUN — no data written. Re-run with --write to push to Supabase.")


if __name__ == "__main__":
    main()
