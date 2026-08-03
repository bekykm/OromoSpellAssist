# Afaan Oromo Linguistic Background

This document is the linguistic justification for the phonemic tokenizer
(`backend/app/phonology.py`) and the weighted edit-distance model
(`backend/app/candidate_generation.py`). Every orthographic rule the code
encodes is cited to a source below; see `docs/references.md` for full
IEEE-format entries.

## 1. Qubee: the Latin-based Oromo orthography

Afaan Oromo is written in **Qubee**, a Latin-based orthography officially
adopted in 1991, replacing earlier Ge'ez-script and inconsistent
Latin-based conventions [3], [4]. A central motivation for adopting Qubee
over Ge'ez script was that Ge'ez could not mark consonant gemination or
vowel length — both contrastive in Oromo — while a doubled-letter Latin
convention could [3].

## 2. Digraphs

Qubee represents several Oromo consonant phonemes that have no single
Latin letter using two-letter **digraphs**: `dh`, `ch`, `ny`, `sh`, `ts`,
`ph` [1]–[3]. Each digraph is a single phonemic unit, not a
consonant cluster, and must be segmented as one token — not two — when
computing orthographic similarity. This is why
`phonology.tokenize("sanyi")` yields `["s", "a", "ny", "i"]` (four
phonemic units) rather than five characters treated independently.

**Table 1** (implemented as `DIGRAPHS` in `phonology.py`):

| Digraph | Example word | Gloss |
|---|---|---|
| dh | dhugaa | truth |
| ch | — | (affricate) |
| ny | sanyi | seed / offspring / breed |
| sh | — | (postalveolar fricative) |
| ts | — | (ejective affricate) |
| ph | — | (ejective/aspirated stop, loanword contexts) |

## 3. Vowel length (contrastive)

Oromo has the five-vowel Cushitic inventory (a, e, i, o, u), each with a
phonemically contrastive short and long counterpart. Length is marked
orthographically by doubling the vowel letter: `aa`, `ee`, `ii`, `oo`,
`uu` [1]–[3]. Vowel length is not a spelling nicety — minimal pairs
differ in meaning purely by length:

- **dhuga** (short *a*) = "drink" (imperative) vs. **dhugaa** (long
  *aa*) = "truth"

This is the running example in the system specification and is directly
implemented: `token_edit_distance` assigns the `dhuga`/`dhugaa` pair a
cost of 0.5 (a cheap, linguistically-typed edit — `vowel_length`) rather
than the 1.0 an orthography-blind edit-distance model would assign to any
single-character insertion.

## 4. Consonant gemination (contrastive)

Consonant length (gemination) is independently contrastive and marked by
doubling the consonant letter: `bb`, `dd`, `gg`, `kk`, `ll`, `mm`, `nn`,
`rr`, `ss`, `tt`, etc. [1]–[3]. A canonical published minimal pair is:

- **badaa** = "bad" vs. **baddaa** = "highland" [3]

The system's own running example extends this:

- **gadaa** = "Gadaa system" (the traditional Oromo generational
  socio-political institution) vs. **gadda** = "sadness / grief"

Note that `gadaa` vs. `gadda` actually differs in *two* independent
respects when phonemically aligned — the final vowel length (`aa` vs.
`a`) and the medial consonant gemination (`d` vs. `dd`) — which is why
`token_edit_distance(tokenize("gadaa"), tokenize("gadda")).cost == 1.0`
(two stacked 0.5-cost linguistic edits), still far cheaper than an
arbitrary two-character edit (cost 2.0) between unrelated words of the
same length. This is exercised in
`backend/tests/test_candidate_generation.py`.

## 5. Why these are not "typos"

The system design in `docs/architecture.md` and the ranking/explanation
modules exist specifically because vowel length and gemination
differences in Afaan Oromo frequently cross a **lexical**, not merely
orthographic, boundary. A conventional spell checker that silently
"corrects" `dhuga` to `dhugaa` (or vice versa) risks substituting a
grammatically and semantically valid word with a different one — the
motivating problem statement for this project. This is consistent with
the broader literature-review finding that low-resource languages'
orthographic/morphological complexity is a recurring source of NLP tool
failure when high-resource-language assumptions (e.g. "small edit
distance implies typo") are ported over without adaptation [9], [10].

## 6. Prior Afaan Oromo NLP work this project builds on / departs from

Existing Afaan Oromo spelling- and grammar-checking systems are
predominantly **correction-oriented**: they use plain (unweighted)
Levenshtein/Damerau-Levenshtein distance and bigram context models to
pick a single "best" correction [7], [8], and report aggregate accuracy
(e.g. 93.9% correction accuracy on a 14,896/3,231-word train/test split
in [7]; 73–76% spelling-error P/R/F in the integrated grammar-checker
system in [8], which also compiled a ~300,000-word training corpus and
~300 hand-written grammar rules). None of the systems found in the
literature review are meaning-preserving-by-design: they are not
evaluated on, nor architected to avoid, the specific failure mode of
silently replacing one valid word with a different valid word of
different meaning. That gap is this project's contribution (see
`docs/dataset.md` and `docs/evaluation-plan.md` for how this is measured
against a plain-edit-distance baseline).
