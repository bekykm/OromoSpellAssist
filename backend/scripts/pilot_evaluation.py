"""Pilot evaluation: proposed Oromo-aware system (P1) vs. traditional
character-level edit-distance baseline (B0), run over the 10-entry
illustrative (unvalidated) seed lexicon.

This is a small-scale proof-of-concept run, not a claim of generalizable
performance -- see docs/evaluation-plan.md and the manuscript's
Limitations section. Output is written as JSON to stdout so it can be
embedded verbatim (no hand-copied/rounded numbers) into the manuscript.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.baseline import baseline_suggest
from app.candidate_generation import generate_candidates
from app.db import get_session, seed_from_csv
from app.models import LexicalEntry
from app.ranking import rank_candidates

SEED_CSV = Path(__file__).resolve().parent.parent.parent / "dataset" / "lexicon_seed.csv"

# (typed, intended, contrast_type)
TEST_ITEMS = [
    ("dhuga", "dhugaa", "vowel_length"),
    ("dhugaa", "dhuga", "vowel_length"),
    ("dhuga", "dhuguma", "other_affixal"),
    ("dhuguma", "dhuga", "other_affixal"),
    ("dhugaa", "dhuguma", "other_affixal"),
    ("dhuguma", "dhugaa", "other_affixal"),
    ("gadaa", "gadda", "mixed_gemination_vowel"),
    ("gadda", "gadaa", "mixed_gemination_vowel"),
    ("rafuu", "raafuu", "vowel_length"),
    ("raafuu", "rafuu", "vowel_length"),
    ("badaa", "baddaa", "gemination"),
    ("baddaa", "badaa", "gemination"),
]

MAX_COST_P1 = 2.5
MAX_DIST_B0 = 3


def load_lexicon():
    session = get_session(Path(__file__).resolve().parent / "_pilot_eval.db")
    seed_from_csv(session, SEED_CSV)
    entries = session.query(LexicalEntry).all()
    entries_by_word = {e.word: e for e in entries}
    vocabulary = list(entries_by_word.keys())
    session.close()
    return vocabulary, entries_by_word


def rank_of(word: str, ordered_words: list[str]) -> int | None:
    try:
        return ordered_words.index(word) + 1
    except ValueError:
        return None


def true_neighbors(entry: LexicalEntry) -> set[str]:
    return set(entry.related_words_list()) | {entry.word}


def evaluate_system(name: str, vocabulary, entries_by_word, get_ordered_words):
    """Note: the exact-typed word is *always* included in the candidate
    set at the top rank in both B0 and P1 (distance/cost 0 by
    construction -- see candidate_generation.generate_candidates and
    baseline.baseline_suggest), because presenting the word the user
    actually typed, if it is itself valid, is part of this system's
    design (Section 4). That makes rank/Top-1 computed over the *full*
    ordered list structurally uninformative for typed != intended test
    items (rank 1 is always taken by "typed" itself), so rank, Top-1,
    Top-3, and MRR below are computed over the ranking of *other*
    candidates only -- i.e., how the system orders the alternatives to
    the word the user actually typed, which is the comparison that can
    actually differ between B0 and P1.
    """
    per_item = []
    for typed, intended, contrast in TEST_ITEMS:
        ordered_all = get_ordered_words(typed, vocabulary, entries_by_word)
        ordered = [w for w in ordered_all if w != typed]
        rank = rank_of(intended, ordered)
        top3 = set(ordered[:3])
        predicted = set(ordered)
        true_set = true_neighbors(entries_by_word[typed]) - {typed}
        tp = len(predicted & true_set)
        precision = tp / len(predicted) if predicted else 0.0
        recall = tp / len(true_set) if true_set else None
        per_item.append(
            {
                "typed": typed,
                "intended": intended,
                "contrast_type": contrast,
                "candidate_found": rank is not None,
                "rank": rank,
                "top1": rank == 1,
                "top3": intended in top3,
                "reciprocal_rank": (1.0 / rank) if rank else 0.0,
                "precision": precision,
                "recall": recall,
            }
        )

    n = len(per_item)
    recalls = [x["recall"] for x in per_item if x["recall"] is not None]
    summary = {
        "system": name,
        "n_items": n,
        "candidate_generation_accuracy": sum(x["candidate_found"] for x in per_item) / n,
        "top1_accuracy": sum(x["top1"] for x in per_item) / n,
        "top3_accuracy": sum(x["top3"] for x in per_item) / n,
        "mrr": sum(x["reciprocal_rank"] for x in per_item) / n,
        "mean_precision": sum(x["precision"] for x in per_item) / n,
        "mean_recall": (sum(recalls) / len(recalls)) if recalls else None,
    }
    by_contrast = {}
    for ctype in sorted({x["contrast_type"] for x in per_item}):
        items = [x for x in per_item if x["contrast_type"] == ctype]
        m = len(items)
        by_contrast[ctype] = {
            "n": m,
            "top1_accuracy": sum(x["top1"] for x in items) / m,
            "top3_accuracy": sum(x["top3"] for x in items) / m,
            "mrr": sum(x["reciprocal_rank"] for x in items) / m,
        }
    return summary, by_contrast, per_item


def b0_ordered_words(typed, vocabulary, entries_by_word):
    return [c.word for c in baseline_suggest(typed, vocabulary, max_distance=MAX_DIST_B0)]


def p1_ordered_words(typed, vocabulary, entries_by_word):
    candidates = generate_candidates(typed, vocabulary, max_cost=MAX_COST_P1)
    ranked = rank_candidates(candidates, entries_by_word)
    return [r.entry.word for r in ranked]


def main():
    vocabulary, entries_by_word = load_lexicon()

    b0_summary, b0_by_contrast, b0_items = evaluate_system("B0_char_edit_distance", vocabulary, entries_by_word, b0_ordered_words)
    p1_summary, p1_by_contrast, p1_items = evaluate_system("P1_oromo_aware", vocabulary, entries_by_word, p1_ordered_words)

    result = {
        "lexicon_size": len(vocabulary),
        "n_test_items": len(TEST_ITEMS),
        "B0": {"summary": b0_summary, "by_contrast_type": b0_by_contrast},
        "P1": {"summary": p1_summary, "by_contrast_type": p1_by_contrast},
        "B0_items": b0_items,
        "P1_items": p1_items,
    }
    print(json.dumps(result, indent=2))

    db_file = Path(__file__).resolve().parent / "_pilot_eval.db"
    if db_file.exists():
        db_file.unlink()


if __name__ == "__main__":
    main()
