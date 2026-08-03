from app.candidate_generation import generate_candidates, token_edit_distance
from app.phonology import tokenize


def test_dhuga_dhugaa_is_a_cheap_vowel_length_edit():
    dist = token_edit_distance(tokenize("dhuga"), tokenize("dhugaa"))
    assert dist.cost == 0.5
    kinds = [op.kind for op in dist.ops if op.kind != "match"]
    assert kinds == ["vowel_length"]


def test_gadaa_gadda_differs_by_gemination_and_vowel_length():
    # gadaa = g-a-d-aa (long vowel) vs gadda = g-a-dd-a (geminate consonant):
    # the two words differ in *two* linguistically-motivated ways at once,
    # so the weighted cost is the sum of both cheap edits (0.5 + 0.5),
    # still well below an arbitrary two-substitution edit (2.0).
    dist = token_edit_distance(tokenize("gadaa"), tokenize("gadda"))
    assert dist.cost == 1.0
    kinds = sorted(op.kind for op in dist.ops if op.kind != "match")
    assert kinds == ["gemination", "vowel_length"]


def test_arbitrary_substitution_costs_more_than_linguistic_edits():
    linguistic = token_edit_distance(tokenize("dhuga"), tokenize("dhugaa")).cost
    arbitrary = token_edit_distance(tokenize("dhuga"), tokenize("dhugax")).cost
    assert linguistic < arbitrary


def test_generate_candidates_includes_exact_match_and_near_neighbors():
    vocabulary = ["dhuga", "dhugaa", "dhuguma", "gadaa", "gadda", "unrelated"]
    candidates = generate_candidates("dhuga", vocabulary, max_cost=1.5)
    words = {c.word for c in candidates}
    assert "dhuga" in words  # exact match retained, cost 0
    assert "dhugaa" in words  # vowel-length neighbor
    assert "unrelated" not in words

    exact = next(c for c in candidates if c.word == "dhuga")
    assert exact.distance.cost == 0.0
    # nearest candidates should be ranked first
    assert candidates[0].distance.cost <= candidates[-1].distance.cost
