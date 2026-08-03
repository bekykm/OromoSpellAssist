# Evaluation Plan

## Task formulation

For a test set of `(typed_word, intended_word)` pairs mined from real
usage (see "Test set construction" below) — where `typed_word` may equal
`intended_word` (the user typed a valid word and the system should say
so) or differ from it (the user typed a different valid word than they
meant) — evaluate whether the system's ranked suggestion list surfaces
`intended_word`.

This is deliberately **not** classic non-word spelling-correction
evaluation (typed word is never a dictionary word). Because the system
is designed to disambiguate between *multiple valid words*, the test set
must include cases where `typed_word` is itself valid but ambiguous with
a near-neighbor — this is the paper's core claim and must be
foregrounded in evaluation, not treated as an edge case.

## Metrics

1. **Candidate generation accuracy** — fraction of test items where
   `intended_word` appears anywhere in the raw candidate set returned by
   `generate_candidates` (upper bound on everything downstream; a ranking
   or explanation bug cannot fix a candidate-generation miss).
2. **Top-1 suggestion accuracy** — fraction where `intended_word` is
   ranked first.
3. **Top-3 suggestion accuracy** — fraction where `intended_word` is in
   the top 3.
4. **Mean Reciprocal Rank (MRR)** — `mean(1 / rank(intended_word))` over
   the test set (0 if not found within the search cutoff).
5. **Precision / Recall / F1** at the candidate-set level, treating
   "words the system proposes" vs. "words that are genuinely orthographic
   near-neighbors with distinct meanings" (per the validated dataset) as
   the positive class — this measures over-triggering (proposing
   unrelated words) as well as coverage.

## Baseline

**Baseline (B0): plain Damerau-Levenshtein distance** over raw
characters, unweighted, with the same candidate/ranking/explanation
pipeline structure but `SUBSTITUTION_COST` collapsed to a constant 1.0
(i.e., `phonology`-aware weighting disabled). This isolates the
contribution of the Oromo-aware weighting scheme from everything else
(lexicon, ranking features, explanation generation), which is the
correct ablation for the paper's central claim.

**Proposed (P1): full system** — weighted phonemic edit distance +
frequency + validity + semantic-context ranking.

Recommended additional ablations for Table 6:
- **P2**: weighted distance, but ranking by orthographic similarity only
  (`w_f = w_v = w_s = 0`) — isolates the ranking function's contribution
  separately from the distance function's.
- **P3**: full system with `context` supplied vs. omitted — isolates the
  (currently placeholder) semantic-relevance term; only meaningful once
  `ranking.semantic_relevance` is upgraded from lexical overlap to an
  embedding-based scorer (see `docs/architecture.md` future-work note).

## Table 5 — Comparison with baseline methods (template)

| System | Candidate-gen accuracy | Top-1 | Top-3 | MRR | Precision | Recall | F1 |
|---|---|---|---|---|---|---|---|
| B0: plain Damerau-Levenshtein | — | — | — | — | — | — | — |
| P1: Oromo-aware (proposed) | — | — | — | — | — | — | — |
| P2: Oromo-aware, orthographic-only ranking | — | — | — | — | — | — | — |
| P3: Oromo-aware + semantic context | — | — | — | — | — | — | — |

(Cells intentionally blank — populate only after running the pipeline
against a validated test set; do not fabricate placeholder numbers.)

## Table 6 — Evaluation results (template)

Same column structure as Table 5, but broken out by **contrast type**
(vowel-length pairs, gemination pairs, digraph-confusion pairs, mixed),
so the paper can show *where* the Oromo-aware weighting helps most
rather than only an aggregate number.

## Table 7 — Error categories (template)

| Category | Description | Example (fill in from real errors) |
|---|---|---|
| Missed candidate | intended word not generated at all | — |
| Ranking miscall | generated but not top-1/top-3 | — |
| Over-triggering | system flags a correctly-spelled, unambiguous word | — |
| Wrong explanation | correct candidate, wrong stated reason for the difference | — |
| Annotation disagreement | test-set label itself contested by validators | — |

## Test set construction

1. **In-vocabulary ambiguity test items**: for every mined minimal/near-
   minimal pair in the validated dataset (`docs/dataset.md`), generate
   one test item per direction (e.g. both `dhuga -> dhugaa` and
   `dhugaa -> dhuga` as separate items), using the example sentences as
   `context`.
2. **Real user-error items**: if available, sample actual mistyped
   Afaan Oromo words from a corpus/crowdsourcing task, with the
   intended word confirmed by the original writer or a validator —
   this is the only source that measures real-world error distribution
   rather than synthetic pairs.
3. **Negative controls**: correctly-typed, unambiguous words (no
   near-neighbor within the weighted-distance threshold) to measure
   over-triggering (false positive suggestion rate).

## Experimental setup checklist

- Fixed train/dev/test split at the *word-pair* level (not just word
  level) to avoid leaking one direction of a pair into training/tuning
  and the other into test.
- Report `max_cost` (search threshold) and ranking weights used;
  tune only on dev, report final numbers on held-out test once.
- Report native-speaker inter-annotator agreement on the test-set labels
  themselves (an unreliable label makes every downstream metric
  unreliable).
- Statistical significance: paired bootstrap resampling over test items
  when comparing P1 vs. B0 Top-1/MRR, given likely small test-set size
  for a low-resource language.
