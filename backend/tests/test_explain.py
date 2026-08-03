from pathlib import Path

from app.candidate_generation import generate_candidates
from app.db import get_session, seed_from_csv
from app.explain import build_suggestions, render_message
from app.models import LexicalEntry
from app.ranking import rank_candidates

SEED_CSV = Path(__file__).resolve().parent.parent.parent / "dataset" / "lexicon_seed.csv"


def test_dhuga_yields_the_paper_example_message(tmp_path):
    session = get_session(tmp_path / "test_lexicon.db")
    seed_from_csv(session, SEED_CSV)
    entries = session.query(LexicalEntry).all()
    entries_by_word = {e.word: e for e in entries}
    vocabulary = list(entries_by_word.keys())
    session.close()

    candidates = generate_candidates("dhuga", vocabulary, max_cost=2.0)
    ranked = rank_candidates(candidates, entries_by_word)
    candidates_by_word = {c.word: c for c in candidates}
    suggestions = build_suggestions(ranked, candidates_by_word, top_k=2)
    message = render_message("dhuga", suggestions)

    words_in_message = {s.word for s in suggestions}
    assert words_in_message == {"dhuga", "dhugaa"}
    assert "dhuga" in message and "dhugaa" in message
    assert "drink" in message and "truth" in message
