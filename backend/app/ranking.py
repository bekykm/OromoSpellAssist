"""Candidate ranking (Table 4: candidate ranking features).

score(c) = w_o * orthographic_similarity(c)
         + w_f * frequency_score(c)
         + w_v * lexical_validity(c)
         + w_s * semantic_relevance(c, context)

The four features are deliberately kept separable so the ranking function
can be ablated in evaluation (Table 6) -- e.g. reporting Top-1 accuracy
with w_s = 0 (no semantic context) vs w_s > 0.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from .candidate_generation import Candidate
from .models import LexicalEntry

DEFAULT_WEIGHTS = {
    "orthographic": 0.45,
    "frequency": 0.20,
    "validity": 0.10,
    "semantic": 0.25,
}


@dataclass
class RankedCandidate:
    entry: LexicalEntry
    distance_cost: float
    orthographic_similarity: float
    frequency_score: float
    validity_score: float
    semantic_score: float
    final_score: float


def orthographic_similarity(distance_cost: float, max_len: int) -> float:
    """Normalize weighted edit cost into a [0, 1] similarity score."""
    if max_len == 0:
        return 0.0
    return max(0.0, 1.0 - (distance_cost / max_len))


def frequency_score(frequency_rank: int) -> float:
    """Lower rank == more frequent == higher score. Log-scaled so the
    long tail of rare words doesn't dominate the ranking."""
    return 1.0 / math.log2(max(frequency_rank, 1) + 2)


def semantic_relevance(entry: LexicalEntry, context: str | None) -> float:
    """Placeholder for context-aware semantic scoring.

    In this scaffold, with no sentence context or embedding model wired
    in, this returns a neutral constant. The intended extension point
    (documented as future work in the manuscript) is: embed `context`
    and `entry.meaning`/`entry.examples` with an Oromo-capable sentence
    encoder and return cosine similarity, so that e.g. a preceding
    religious-register context nudges disambiguation toward "dhugaa"
    (truth) over "dhuga" (drink).
    """
    if not context:
        return 0.5
    context_terms = set(context.lower().split())
    meaning_terms = set(entry.meaning.lower().split())
    if not context_terms or not meaning_terms:
        return 0.5
    overlap = len(context_terms & meaning_terms)
    return 0.5 + 0.5 * min(1.0, overlap / max(1, len(meaning_terms)))


def rank_candidates(
    candidates: list[Candidate],
    entries_by_word: dict[str, LexicalEntry],
    context: str | None = None,
    weights: dict[str, float] = DEFAULT_WEIGHTS,
) -> list[RankedCandidate]:
    ranked: list[RankedCandidate] = []
    for c in candidates:
        entry = entries_by_word.get(c.word)
        if entry is None:
            continue
        max_len = max(len(c.word), 1)
        o = orthographic_similarity(c.distance.cost, max_len)
        f = frequency_score(entry.frequency_rank)
        v = 1.0 if entry.validated else 0.6
        s = semantic_relevance(entry, context)
        final = (
            weights["orthographic"] * o
            + weights["frequency"] * f
            + weights["validity"] * v
            + weights["semantic"] * s
        )
        ranked.append(
            RankedCandidate(
                entry=entry,
                distance_cost=c.distance.cost,
                orthographic_similarity=o,
                frequency_score=f,
                validity_score=v,
                semantic_score=s,
                final_score=final,
            )
        )
    ranked.sort(key=lambda r: r.final_score, reverse=True)
    return ranked
