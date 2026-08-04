"""Traditional (Oromo-unaware) edit-distance baseline, used only for the
comparative pilot evaluation in docs/evaluation-plan.md and the
manuscript. This is deliberately the naive approach the rest of the
system is contrasted against: raw character-level Damerau-Levenshtein
distance, unit costs, no phonemic tokenization, no frequency/validity/
semantic ranking [10], [11]."""

from __future__ import annotations

from dataclasses import dataclass


def char_edit_distance(a: str, b: str) -> int:
    a, b = a.lower(), b.lower()
    n, m = len(a), len(b)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            )
            if (
                i > 1
                and j > 1
                and a[i - 1] == b[j - 2]
                and a[i - 2] == b[j - 1]
            ):
                dp[i][j] = min(dp[i][j], dp[i - 2][j - 2] + 1)
    return dp[n][m]


@dataclass
class BaselineCandidate:
    word: str
    distance: int


def baseline_suggest(input_word: str, vocabulary: list[str], max_distance: int = 2) -> list[BaselineCandidate]:
    """Rank purely by raw character edit distance -- no linguistic
    weighting, no frequency, no semantic context. Includes the exact
    match (distance 0) for parity with the proposed system's candidate
    set, isolating the ranking/weighting contribution as the only
    variable under test."""
    results = [
        BaselineCandidate(w, char_edit_distance(input_word, w))
        for w in vocabulary
    ]
    results = [c for c in results if c.distance <= max_distance]
    results.sort(key=lambda c: c.distance)
    return results
