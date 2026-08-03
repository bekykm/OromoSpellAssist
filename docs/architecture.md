# System Architecture

This document specifies the architecture implemented in `backend/` and
`frontend/`. Diagrams are Mermaid; GitHub and most Markdown viewers render
them natively.

## Figure 1 — Overall System Architecture

```mermaid
flowchart LR
    subgraph Client["Microsoft Word (Office Add-in)"]
        A[Word document] -->|user selects word| B[Taskpane React app<br/>frontend/src/taskpane]
        B -->|Office.js Word.run| A
    end

    subgraph Service["Backend NLP Service (FastAPI)"]
        C[/GET /suggest/]
        D[Word identification]
        E[Dictionary lookup]
        F[Orthographic similarity search<br/>candidate_generation.py]
        G[Candidate ranking<br/>ranking.py]
        H[Meaning retrieval]
        I[Explanation generation<br/>explain.py]
    end

    J[(Afaan Oromo Lexical Database<br/>SQLite / Postgres)]

    B -->|HTTPS GET /suggest?word=...| C
    C --> D --> E --> F --> G --> H --> I
    E <--> J
    F <--> J
    H <--> J
    I -->|JSON: message, suggestions, explanations| B
```

## Figure 2 — Candidate Generation Workflow

```mermaid
flowchart TD
    A[Input word] --> B[phonology.tokenize<br/>digraph / long-vowel / geminate segmentation]
    B --> C{For each vocabulary word}
    C --> D[phonology.tokenize candidate]
    D --> E[token_edit_distance<br/>weighted DP over phoneme tokens]
    E --> F{cost <= max_cost?}
    F -- yes --> G[Add to candidate set<br/>with traced edit operations]
    F -- no --> C
    G --> H[Sort by weighted cost]
    H --> I[Candidate list -> ranking.py]
```

## Figure 3 — Orthographic Similarity Model

The similarity model operates on *phonemic tokens*, not raw characters.
Weighted substitution costs are lower for edits that correspond to
contrastive Afaan Oromo orthographic phenomena (Table 1), so a
vowel-length or gemination difference scores as "closer" than an
arbitrary substitution of equal character-edit-distance.

```mermaid
flowchart LR
    A["Raw word: dhuga"] --> B[Tokenizer]
    B --> C["Tokens: dh, u, g, a"]
    C --> D{Compare token-by-token<br/>against candidate tokens}
    D -->|same letter, length differs| E["vowel_length: cost 0.5"]
    D -->|same letter, gemination differs| F["gemination: cost 0.5"]
    D -->|digraph vs its base consonant| G["digraph: cost 0.7"]
    D -->|unrelated letters| H["sub / ins / del: cost 1.0"]
```

## Figure 4 — Lexical Disambiguation Pipeline

```mermaid
flowchart TD
    A[Ranked candidates] --> B[build_suggestions<br/>top_k selection]
    B --> C[explain_difference per candidate<br/>dominant edit-operation]
    C --> D[render_message<br/>'Did you mean X (meaning) or Y (meaning)?']
    C --> E[render_explanations<br/>per-candidate detail lines]
    D --> F[SuggestResponse JSON]
    E --> F
```

## Figure 5 — Microsoft Word Plugin Architecture

```mermaid
flowchart TD
    subgraph Word["Word Desktop / Word Online"]
        M[manifest.xml] --> R[Ribbon button:<br/>Oromo Assistant > Check Spelling]
        R --> T[Taskpane.html]
    end
    T --> TC[Taskpane.tsx<br/>React component]
    TC --> OFF[office.ts<br/>Office.js: read selection]
    TC --> API[api.ts<br/>fetch(/suggest)]
    API -->|HTTPS| BE[FastAPI backend]
    OFF -->|Word.run| DOC[(Active document)]
```

## Component Diagram

```mermaid
flowchart TB
    subgraph Frontend
        Taskpane.tsx
        api.ts
        office.ts
    end
    subgraph Backend
        main.py
        candidate_generation.py
        ranking.py
        explain.py
        phonology.py
        models.py
        db.py
    end
    Lexicon[(lexicon.db)]

    Taskpane.tsx --> api.ts
    Taskpane.tsx --> office.ts
    api.ts --> main.py
    main.py --> candidate_generation.py
    main.py --> ranking.py
    main.py --> explain.py
    candidate_generation.py --> phonology.py
    main.py --> db.py
    db.py --> models.py
    db.py --> Lexicon
```

## Data Flow Diagram

```mermaid
flowchart LR
    U((User)) -->|types/selects word| Doc[Word document]
    Doc -->|Office.js selection| TP[Taskpane]
    TP -->|word, optional context| API[/suggest endpoint/]
    API -->|SQL query| DB[(Lexical DB)]
    DB -->|vocabulary + entries| API
    API -->|ranked, explained suggestions| TP
    TP -->|renders| U
```

## Scaling the search

`candidate_generation.generate_candidates` is brute-force over the full
vocabulary, which is adequate for the seed lexicon (tens of entries) and
for evaluation on a moderate-size dataset. For a production-scale lexicon
(tens of thousands of entries), replace the linear scan with either:

1. A **BK-tree** keyed on the weighted token-edit distance (the distance
   satisfies the triangle inequality, so BK-tree pruning is valid), or
2. A **phoneme n-gram inverted index** (index each lexicon word by its
   bigrams of phonemic tokens; only score candidates sharing at least one
   bigram with the query).

Both are drop-in replacements behind `generate_candidates`'s interface and
do not change `ranking.py` or `explain.py`.

## Deployment

- **Backend**: containerize `backend/` (FastAPI + Uvicorn) behind HTTPS;
  the Office Add-in's `AppDomains` in `manifest.xml` and the CORS origin
  in `main.py` must both be updated from `localhost` to the deployed
  domain before distribution.
- **Frontend**: `npm run build` produces static assets (`dist/`) served
  over HTTPS (Office Add-ins require HTTPS `SourceLocation`); the
  manifest can then be distributed via AppSource, centralized deployment
  (Microsoft 365 admin center), or sideloading for evaluation.
