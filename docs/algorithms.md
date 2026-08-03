# Algorithm Design

Formal pseudocode for the three core algorithms, matching the
implementation in `backend/app/`. Complexity is given per query word,
where `n` = number of phonemic tokens in the input word, `V` = lexicon
size, `m` = average tokens per lexicon word.

## Algorithm 1 — Oromo-Aware Phonemic Tokenization

Input: raw Qubee-orthography word `w`
Output: sequence of tokens, each tagged with its phonemic class

```
TOKENIZE(w):
    tokens <- []
    i <- 0
    while i < len(w):
        pair <- lowercase(w[i:i+2])
        if pair in DIGRAPHS:                          # dh, ch, ny, sh, ts, ph
            tokens.append(Token(w[i:i+2], DIGRAPH)); i += 2; continue
        if len(pair) == 2 and pair[0] == pair[1] and pair[0] in VOWELS:
            tokens.append(Token(w[i:i+2], LONG_VOWEL)); i += 2; continue
        if len(pair) == 2 and pair[0] == pair[1] and pair[0] in CONSONANTS:
            tokens.append(Token(w[i:i+2], GEMINATE)); i += 2; continue
        cls <- VOWEL if w[i] in VOWELS else CONSONANT
        tokens.append(Token(w[i], cls)); i += 1
    return tokens
```

Complexity: O(n) per word. Priority order (digraph > length-pair >
single grapheme) is what reproduces the reference segmentation
`sanyi -> s | a | ny | i` (Table 1).

## Algorithm 2 — Oromo-Aware Candidate Generation

Input: input word `w`, lexicon vocabulary `L = {l_1, ..., l_V}`, threshold `theta`
Output: candidate set `C` with weighted distances and edit traces

```
GENERATE_CANDIDATES(w, L, theta):
    src <- TOKENIZE(w)
    C <- {}
    for l in L:
        tgt <- TOKENIZE(l)
        if | |src| - |tgt| | > theta + 1:  continue     # cheap length pre-filter
        d <- WEIGHTED_EDIT_DISTANCE(src, tgt)
        if d.cost <= theta:
            C <- C U { (l, d) }                          # includes d.cost = 0 (l == w)
    return SORT_ASCENDING(C, key = cost)

WEIGHTED_EDIT_DISTANCE(src, tgt):                        # Damerau-Levenshtein over tokens
    dp[0..n][0..m], back[0..n][0..m]
    dp[i][0] <- i, dp[0][j] <- j                          # standard base cases
    for i in 1..n:
      for j in 1..m:
        (cost, kind) <- SUBSTITUTION_COST(src[i], tgt[j])
        dp[i][j] <- min(
            dp[i-1][j-1] + cost,                          # match / substitution family
            dp[i-1][j]   + 1.0,                           # deletion
            dp[i][j-1]   + 1.0,                           # insertion
            dp[i-2][j-2] + 1.0   if adjacent-transpose(src, tgt, i, j) else INF
        )
    return dp[n][m], TRACEBACK(back)

SUBSTITUTION_COST(a, b):
    if a.surface == b.surface:                    return (0.0, MATCH)
    if VOWEL_LENGTH_PAIR(a, b):                    return (0.5, VOWEL_LENGTH)
    if GEMINATION_PAIR(a, b):                      return (0.5, GEMINATION)
    if DIGRAPH_CONFUSION(a, b):                    return (0.7, DIGRAPH)
    return (1.0, SUB)
```

Complexity: O(V . n . m) worst case; O(V) average-case after the length
pre-filter on lexicons where word-length variance is high. See
`docs/architecture.md`, "Scaling the search" for the BK-tree / n-gram
index replacement at production lexicon scale.

## Algorithm 3 — Candidate Ranking

Input: candidate set `C`, lexicon entries, optional sentence context `ctx`
Output: `C` sorted by descending suggestion score

```
RANK(C, entries, ctx, weights = {w_o, w_f, w_v, w_s}):
    R <- []
    for (word, d) in C:
        e <- entries[word]
        o <- max(0, 1 - d.cost / max(len(word), 1))        # orthographic similarity
        f <- 1 / log2(e.frequency_rank + 2)                # frequency score
        v <- 1.0 if e.validated else 0.6                   # lexical validity
        s <- SEMANTIC_RELEVANCE(e, ctx)                    # context overlap / embedding sim.
        score <- w_o.o + w_f.f + w_v.v + w_s.s
        R <- R U { (e, score) }
    return SORT_DESCENDING(R, key = score)
```

Default weights `(w_o, w_f, w_v, w_s) = (0.45, 0.20, 0.10, 0.25)`
(`backend/app/ranking.py::DEFAULT_WEIGHTS`), tunable per Table 6's
ablation columns.

## Algorithm 4 — Meaning-Aware Suggestion Generation

Input: ranked candidates `R`, top_k
Output: natural-language message + per-candidate explanation lines

```
BUILD_SUGGESTIONS(R, top_k):
    S <- []
    for (e, score) in R[0:top_k]:
        op <- DOMINANT_EDIT_OP(edit_trace(e))               # priority: vowel_length >
        explanation <- EXPLAIN(op)                           # gemination > digraph > sub/ins/del
        S <- S + [Suggestion(e.word, e.meaning, e.pos, explanation, score)]
    return S

RENDER_MESSAGE(input_word, S):
    if S is empty:            return "No close matches found for '{input_word}'."
    if |S| == 1 and S[0].word == input_word:
                               return "'{S[0].word}' is a valid word meaning '{S[0].meaning}'."
    if |S| == 1:               return "Did you mean '{S[0].word}' ({S[0].meaning})?"
    return "Did you mean " + JOIN(["'{s.word}' ({s.meaning})" for s in S], sep=", ", last_sep=", or ") + "?"
```

This reproduces the target example exactly:
`GENERATE_CANDIDATES("dhuga", L, 2.0)` -> `{dhuga: 0.0, dhugaa: 0.5, dhuguma: 2.0}`
-> `RENDER_MESSAGE` -> *"Did you mean "dhuga" (drink), "dhugaa" (truth), or "dhuguma" (truly)?"*
(verified in `backend/tests/test_explain.py`).
