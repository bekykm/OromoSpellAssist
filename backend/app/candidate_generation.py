"""Oromo-aware candidate generation.

Standard Damerau-Levenshtein distance operates on raw characters and is
orthography-blind: it scores "dhuga" -> "dhugaa" (a meaningful vowel-length
contrast, drink -> truth) the same as "dhuga" -> "dhugax" (an arbitrary,
meaningless substitution). That is the gap this module addresses.

We instead run weighted edit distance over the *phonemic token* sequence
produced by phonology.tokenize(), with lower substitution/insertion costs
for edits that correspond to the three orthographic phenomena documented
in docs/linguistic-background.md:

  1. vowel-length toggle   (a <-> aa, e <-> ee, ...)
  2. gemination toggle     (d <-> dd, k <-> kk, ...)
  3. digraph under-typing  (dh <-> d, sh <-> s, ...)

This lets the ranking stage (ranking.py) surface exactly the kind of
minimal-pair confusions ("dhuga" vs "dhugaa", "gadaa" vs "gadda") that a
generic edit-distance speller either misses (distance 1 vs "dhugax" too,
no signal) or does not distinguish from noise.
"""

from __future__ import annotations

from dataclasses import dataclass

from .phonology import (
    Token,
    is_digraph_confusion,
    is_gemination_pair,
    is_vowel_length_pair,
    tokenize,
)

# Edit costs. Values < 1.0 make linguistically-motivated edits "cheaper"
# than arbitrary ones, so they rank as closer candidates.
COST_VOWEL_LENGTH = 0.5
COST_GEMINATION = 0.5
COST_DIGRAPH_CONFUSION = 0.7
COST_SUBSTITUTION = 1.0
COST_INSERT_DELETE = 1.0
COST_TRANSPOSITION = 1.0


@dataclass
class EditOp:
    kind: str  # "match" | "vowel_length" | "gemination" | "digraph" | "sub" | "ins" | "del" | "transpose"
    a: str | None
    b: str | None


@dataclass
class DistanceResult:
    cost: float
    ops: list[EditOp]


def _sub_cost_and_kind(a: Token, b: Token) -> tuple[float, str]:
    if a.surface.lower() == b.surface.lower():
        return 0.0, "match"
    if is_vowel_length_pair(a, b):
        return COST_VOWEL_LENGTH, "vowel_length"
    if is_gemination_pair(a, b):
        return COST_GEMINATION, "gemination"
    if is_digraph_confusion(a, b):
        return COST_DIGRAPH_CONFUSION, "digraph"
    return COST_SUBSTITUTION, "sub"


def token_edit_distance(src: list[Token], tgt: list[Token]) -> DistanceResult:
    """Weighted Damerau-Levenshtein distance over phonemic tokens, with a
    full traceback so callers can explain *why* two words are close."""
    n, m = len(src), len(tgt)
    dp = [[0.0] * (m + 1) for _ in range(n + 1)]
    back: list[list[tuple[str, int, int] | None]] = [[None] * (m + 1) for _ in range(n + 1)]

    for i in range(1, n + 1):
        dp[i][0] = i * COST_INSERT_DELETE
        back[i][0] = ("del", i - 1, 0)
    for j in range(1, m + 1):
        dp[0][j] = j * COST_INSERT_DELETE
        back[0][j] = ("ins", 0, j - 1)

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            sub_cost, kind = _sub_cost_and_kind(src[i - 1], tgt[j - 1])
            best_cost = dp[i - 1][j - 1] + sub_cost
            best_move = (kind, i - 1, j - 1)

            del_cost = dp[i - 1][j] + COST_INSERT_DELETE
            if del_cost < best_cost:
                best_cost, best_move = del_cost, ("del", i - 1, j)

            ins_cost = dp[i][j - 1] + COST_INSERT_DELETE
            if ins_cost < best_cost:
                best_cost, best_move = ins_cost, ("ins", i, j - 1)

            if (
                i > 1
                and j > 1
                and src[i - 1].surface.lower() == tgt[j - 2].surface.lower()
                and src[i - 2].surface.lower() == tgt[j - 1].surface.lower()
            ):
                trans_cost = dp[i - 2][j - 2] + COST_TRANSPOSITION
                if trans_cost < best_cost:
                    best_cost, best_move = trans_cost, ("transpose", i - 2, j - 2)

            dp[i][j] = best_cost
            back[i][j] = best_move

    ops: list[EditOp] = []
    i, j = n, m
    while i > 0 or j > 0:
        move = back[i][j]
        assert move is not None
        kind, pi, pj = move
        a = src[i - 1].surface if kind in ("match", "vowel_length", "gemination", "digraph", "sub", "del", "transpose") and i > pi else None
        b = tgt[j - 1].surface if kind in ("match", "vowel_length", "gemination", "digraph", "sub", "ins", "transpose") and j > pj else None
        ops.append(EditOp(kind, a, b))
        i, j = pi, pj

    ops.reverse()
    return DistanceResult(cost=dp[n][m], ops=ops)


@dataclass
class Candidate:
    word: str
    distance: DistanceResult


def generate_candidates(
    input_word: str,
    vocabulary: list[str],
    max_cost: float = 2.0,
) -> list[Candidate]:
    """Search the lexicon for words within max_cost weighted edit distance
    of input_word, INCLUDING an exact match (cost 0) if input_word is
    itself a valid lexicon entry -- e.g. "dhuga" is valid ("drink") and
    must appear alongside "dhugaa" ("truth") in the disambiguation set,
    not be discarded as "the thing the user typed".

    Brute-force over `vocabulary`; for production-scale lexicons this
    should be replaced with a phoneme-n-gram inverted index or BK-tree
    (see docs/architecture.md, "Scaling the search")."""
    src_tokens = tokenize(input_word)
    results: list[Candidate] = []
    for candidate_word in vocabulary:
        tgt_tokens = tokenize(candidate_word)
        # cheap pre-filter to avoid full DP on wildly different lengths
        if abs(len(src_tokens) - len(tgt_tokens)) > max_cost + 1:
            continue
        dist = token_edit_distance(src_tokens, tgt_tokens)
        if dist.cost <= max_cost:
            results.append(Candidate(candidate_word, dist))
    results.sort(key=lambda c: c.distance.cost)
    return results
