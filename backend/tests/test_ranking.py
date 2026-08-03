from pathlib import Path

from app.candidate_generation import generate_candidates
from app.db import get_session, seed_from_csv
from app.models import LexicalEntry
from app.ranking import rank_candidates

SEED_CSV = Path(__file__).resolve().parent.parent.parent / "dataset" / "lexicon_seed.csv"


def _load_entries(tmp_path):
    session = get_session(tmp_path / "test_lexicon.db")
    seed_from_csv(session, SEED_CSV)
    entries = session.query(LexicalEntry).all()
    entries_by_word = {e.word: e for e in entries}
    vocabulary = list(entries_by_word.keys())
    session.close()
    return vocabulary, entries_by_word


def test_dhuga_ranks_itself_and_dhugaa_above_unrelated_words(tmp_path):
    vocabulary, entries_by_word = _load_entries(tmp_path)
    candidates = generate_candidates("dhuga", vocabulary, max_cost=2.0)
    ranked = rank_candidates(candidates, entries_by_word)

    top_words = [r.entry.word for r in ranked[:3]]
    assert "dhuga" in top_words
    assert "dhugaa" in top_words
    assert "gadaa" not in top_words
    assert "baddaa" not in top_words


def test_ranking_is_sorted_descending_by_score():
    from app.candidate_generation import Candidate, token_edit_distance
    from app.phonology import tokenize

    entries_by_word = {
        "dhuga": LexicalEntry(word="dhuga", lemma="dhuga", meaning="drink", pos="verb", category="x", frequency_rank=100, validated=True),
        "dhugaa": LexicalEntry(word="dhugaa", lemma="dhugaa", meaning="truth", pos="noun", category="x", frequency_rank=100000, validated=True),
    }
    candidates = [
        Candidate("dhuga", token_edit_distance(tokenize("dhuga"), tokenize("dhuga"))),
        Candidate("dhugaa", token_edit_distance(tokenize("dhuga"), tokenize("dhugaa"))),
    ]
    ranked = rank_candidates(candidates, entries_by_word)
    scores = [r.final_score for r in ranked]
    assert scores == sorted(scores, reverse=True)
