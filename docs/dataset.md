# Dataset Construction

## Table 3 — Lexical database schema

Implemented as `LexicalEntry` in `backend/app/models.py`.

| Field | Type | Description |
|---|---|---|
| `id` | int, PK | Surrogate key |
| `word` | string | Surface (orthographic) form |
| `lemma` | string | Citation/dictionary form |
| `meaning` | string | Gloss (English) |
| `pos` | string | Part of speech |
| `category` | string | Semantic/word category (e.g. culture-institution, emotion) |
| `related_words` | string | `;`-delimited orthographic near-neighbors with distinct meanings — the actual disambiguation set |
| `variants` | string | `;`-delimited accepted spelling variants of the *same* lemma (dialectal, not distinct-meaning) |
| `examples` | string | Example sentence(s) |
| `frequency_rank` | int | Corpus frequency rank (lower = more frequent); feeds `ranking.py` |
| `validated` | bool | Whether a native-speaker annotator has confirmed word/meaning/examples |

## Seed dataset (`dataset/lexicon_seed.csv`)

The repository ships a **10-entry illustrative seed set**, not a
production lexicon. It exists to (a) make the backend runnable and
testable out of the box, and (b) pin down the minimal-pair examples
already specified in the research design:

| Pair | Words | Contrast type | Meanings |
|---|---|---|---|
| 1 | dhuga / dhugaa | vowel length | drink / truth |
| 2 | dhuga / dhugaa / dhuguma | vowel length + affixation | drink / truth / truly |
| 3 | gadaa / gadda | gemination + vowel length | Gadaa system / sadness |
| 4 | rafuu / raafuu | vowel length | to sleep / (Ethiopian) kale |
| 5 | badaa / baddaa | gemination | bad / highland |
| — | sanyi | (digraph illustration only) | seed / offspring |

**Every row has `validated=false`.** This is deliberate: none of these
glosses have been confirmed by a native Afaan Oromo speaker as part of
this scaffolding work, and the ranking function (`ranking.py`) already
discounts unvalidated entries (validity score 0.6 vs. 1.0). Do not treat
the seed CSV as a citable lexical resource — it is a development fixture.

## Building the production dataset

### 1. Sourcing

Combine, in priority order:

1. **Digitized dictionaries** — Gragg's *Oromo Dictionary* [1] and
   comparable published Oromo–English dictionaries are the highest-
   quality source of headword + gloss + part-of-speech triples, but
   require OCR/manual transcription (they predate machine-readable
   formats) and a licensing check before redistribution in an
   open-source repository — see `LICENSE` and `docs/dataset-licensing.md`
   (create before ingesting any copyrighted dictionary text; do not
   commit raw scanned/OCR'd dictionary content to the public repo
   without confirming redistribution rights).
2. **Existing Afaan Oromo NLP corpora** referenced in prior spelling/
   grammar-checker work — e.g. the ~300,000-word corpus reported in [7]
   — contacting the original authors for access/reuse terms, since none
   of these corpora were confirmed as publicly downloadable during this
   session's search.
3. **Web-crawled Afaan Oromo text** (news sites, Oromia government
   publications, Wikipedia `om.wikipedia.org`) for frequency statistics
   (`frequency_rank`) once a candidate wordlist exists from (1)–(2).

### 2. Candidate minimal-pair mining

Rather than relying only on manually-curated examples, run the
phonemic tokenizer (`phonology.tokenize`) and weighted edit distance
(`candidate_generation.token_edit_distance`) *over the raw wordlist
itself* to automatically surface candidate minimal/near-minimal pairs
(cost ≤ 1.0) for annotator review — this is the same machinery used at
inference time, applied offline as a dataset-construction tool. This
directly targets vowel-length and gemination pairs (Table 1) instead of
depending on annotators to recall them from memory.

### 3. Annotation process

For each mined candidate pair:

1. Two independent native-speaker annotators assign: gloss, part of
   speech, semantic category, and an example sentence.
2. A third annotator adjudicates disagreements (standard double-
   annotation + adjudication design).
3. Record inter-annotator agreement (e.g. Cohen's kappa on part-of-
   speech and on "is this a real, distinct-meaning word" binary
   judgments) — report this in the manuscript's dataset section as a
   data-quality metric.
4. Only entries that pass adjudication are marked `validated=true`.

### 4. Validation by Afaan Oromo speakers

Beyond the annotators who create entries, run a held-out **validation
pass**: a disjoint set of native speakers is shown `(word, meaning)`
pairs (some correct, some deliberately swapped with a near-neighbor's
meaning as a control) and asked to judge correctness. This gives a
human-accuracy upper bound to contextualize the system's own Top-1
accuracy (`docs/evaluation-plan.md`).

### 5. Dataset statement for the manuscript

The manuscript's dataset section must disclose: total entries, number
of minimal/near-minimal pairs, annotator count and background (native
speaker, region/dialect, literacy in Qubee), inter-annotator agreement,
and license. None of these numbers exist yet for a production-scale
dataset — they should be reported only once real annotation has been
carried out, not projected or estimated.
