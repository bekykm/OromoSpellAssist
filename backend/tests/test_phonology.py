from app.phonology import TokenClass, tokenize


def test_digraph_segmentation_sanyi():
    tokens = tokenize("sanyi")
    assert [t.surface for t in tokens] == ["s", "a", "ny", "i"]
    assert tokens[2].cls == TokenClass.DIGRAPH


def test_long_vowel_segmentation_dhugaa():
    tokens = tokenize("dhugaa")
    assert [t.surface for t in tokens] == ["dh", "u", "g", "aa"]
    assert tokens[0].cls == TokenClass.DIGRAPH
    assert tokens[3].cls == TokenClass.LONG_VOWEL


def test_short_vowel_segmentation_dhuga():
    tokens = tokenize("dhuga")
    assert [t.surface for t in tokens] == ["dh", "u", "g", "a"]
    assert tokens[3].cls == TokenClass.SHORT_VOWEL


def test_gemination_segmentation_gadda_vs_gadaa():
    gadda = tokenize("gadda")
    gadaa = tokenize("gadaa")
    assert [t.surface for t in gadda] == ["g", "a", "dd", "a"]
    assert gadda[2].cls == TokenClass.GEMINATE
    assert [t.surface for t in gadaa] == ["g", "a", "d", "aa"]
    assert gadaa[3].cls == TokenClass.LONG_VOWEL


def test_badaa_baddaa_gemination_contrast():
    assert [t.surface for t in tokenize("badaa")] == ["b", "a", "d", "aa"]
    assert [t.surface for t in tokenize("baddaa")] == ["b", "a", "dd", "aa"]
