"""Meaning-aware explanation generation.

Turns a ranked candidate list into the "Did you mean X (meaning) or Y
(meaning)?" style output specified in the research design, plus a short
linguistic explanation of *why* two candidates differ (vowel length,
gemination, digraph) rather than a bare list of strings.
"""

from __future__ import annotations

from dataclasses import dataclass

from .candidate_generation import Candidate, EditOp
from .ranking import RankedCandidate

_KIND_EXPLANATIONS = {
    "vowel_length": "a long vowel ('{b}') where the other has a short vowel ('{a}')",
    "gemination": "a geminated (doubled) consonant ('{b}') where the other has a single consonant ('{a}')",
    "digraph": "the digraph '{b}' where the other has the plain consonant '{a}'",
    "sub": "'{a}' replaced by '{b}'",
    "ins": "an extra '{b}'",
    "del": "a missing '{a}'",
    "transpose": "'{a}' and '{b}' swapped",
}


def _dominant_op(ops: list[EditOp]) -> EditOp | None:
    non_matches = [op for op in ops if op.kind != "match"]
    if not non_matches:
        return None
    priority = {"vowel_length": 0, "gemination": 1, "digraph": 2, "transpose": 3, "sub": 4, "ins": 5, "del": 6}
    return min(non_matches, key=lambda op: priority.get(op.kind, 99))


def explain_difference(candidate: Candidate) -> str:
    """One short clause describing the key orthographic difference."""
    op = _dominant_op(candidate.distance.ops)
    if op is None:
        return "identical spelling"
    template = _KIND_EXPLANATIONS.get(op.kind, "a spelling difference")
    return template.format(a=op.a or "", b=op.b or "")


@dataclass
class Suggestion:
    word: str
    meaning: str
    pos: str
    explanation: str
    score: float


def build_suggestions(
    ranked: list[RankedCandidate],
    original_candidates_by_word: dict[str, Candidate],
    top_k: int = 3,
) -> list[Suggestion]:
    suggestions: list[Suggestion] = []
    for r in ranked[:top_k]:
        cand = original_candidates_by_word[r.entry.word]
        suggestions.append(
            Suggestion(
                word=r.entry.word,
                meaning=r.entry.meaning,
                pos=r.entry.pos,
                explanation=explain_difference(cand),
                score=round(r.final_score, 4),
            )
        )
    return suggestions


def render_message(input_word: str, suggestions: list[Suggestion]) -> str:
    """Render the natural-language 'Did you mean ...?' prompt."""
    if not suggestions:
        return f"No close matches found in the lexicon for \"{input_word}\"."

    if len(suggestions) == 1:
        s = suggestions[0]
        if s.word.lower() == input_word.lower():
            return f'"{s.word}" is a valid word meaning "{s.meaning}".'
        return f'Did you mean "{s.word}" ({s.meaning})?'

    parts = [f'"{s.word}" ({s.meaning})' for s in suggestions]
    joined = ", ".join(parts[:-1]) + f", or {parts[-1]}"
    return f"Did you mean {joined}?"


def render_explanations(suggestions: list[Suggestion]) -> list[str]:
    """One explanatory line per suggestion, for the plugin's detail panel."""
    lines = []
    for s in suggestions:
        if s.explanation == "identical spelling":
            lines.append(f'"{s.word}" ({s.pos}) — this is exactly what you typed; it means "{s.meaning}".')
        else:
            lines.append(f'"{s.word}" ({s.pos}) means "{s.meaning}". Difference: {s.explanation}.')
    return lines
