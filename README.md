# Afaan Oromo Spelling Assistance

**Semantically Informed Spelling Assistance for Afaan Oromo Using
Orthographic Similarity and Lexical Disambiguation.**

This is not a traditional spell checker. Given a typed Afaan Oromo word,
it does **not** silently auto-correct it. It searches an Afaan Oromo
lexical database for orthographically close *valid* words — which, due
to Afaan Oromo's contrastive vowel length and consonant gemination, can
carry entirely different meanings — and presents them with their
meanings so the writer can choose:

```
Input:  dhuga
Output: Did you mean "dhuga" (drink), "dhugaa" (truth), or "dhuguma" (truly)?
```

See `docs/linguistic-background.md` for why this distinction matters
linguistically, and `docs/architecture.md` for how the pipeline works.

A full Q1-journal-style manuscript draft — abstract, related work, the
linguistic background, system/algorithm design, dataset construction,
a pilot evaluation against a plain edit-distance baseline (with honest,
unrounded numbers reproducible from `backend/scripts/pilot_evaluation.py`),
error analysis, limitations, and future work — is at
[`paper/Oromo_Spelling_Assistance_Manuscript.docx`](paper/Oromo_Spelling_Assistance_Manuscript.docx).
Regenerate it with `cd paper/build && npm install && node generate_manuscript.js`
(figures are pre-rendered in `paper/figures/`; rebuild them with
`python3 paper/figures/make_figures.py` if the architecture changes).

## Status

Early-stage research scaffold. The candidate-generation, ranking, and
explanation pipeline is implemented and tested against a small,
**unvalidated** illustrative lexicon (`dataset/lexicon_seed.csv`, 10
entries). It is not yet backed by a production-scale, native-speaker-
validated dataset — see `docs/dataset.md` for the plan to get there, and
`docs/evaluation-plan.md` for how it will be evaluated against a plain
edit-distance baseline.

## Repository structure

```
/backend    FastAPI service: phonology, candidate generation, ranking, explanation
/frontend   Microsoft Word Add-in (TypeScript + React + Office JS API)
/dataset    Lexicon schema seed + dataset construction docs
/docs       Architecture, algorithms, linguistic background, references,
            dataset construction, evaluation plan
```

(`/models` and `/tests` from the originally requested top-level layout
are folded into `backend/app/models.py` and `backend/tests/` — Python
convention keeps a package's models and tests close to its code rather
than as sibling top-level directories.)

## Quick start

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest -q                        # 12 tests, phonology/candidate-gen/ranking/explain
uvicorn app.main:app --reload    # http://127.0.0.1:8000
curl "http://127.0.0.1:8000/suggest?word=dhuga"
```

### Frontend (Word Add-in)

```bash
cd frontend
npm install
npm run dev-server   # https://localhost:3000/taskpane.html
npm run start        # sideload into Word desktop (requires Office + office-addin-debugging)
```

Add real 16/32/80px icons to `frontend/assets/` before sideloading (see
`frontend/assets/README.md`).

## Documentation

| Doc | Contents |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | System, workflow, component, and data-flow diagrams; scaling and deployment notes |
| [`docs/algorithms.md`](docs/algorithms.md) | Pseudocode: tokenization, candidate generation, ranking, suggestion generation |
| [`docs/linguistic-background.md`](docs/linguistic-background.md) | Digraphs, vowel length, gemination — cited |
| [`docs/references.md`](docs/references.md) | IEEE-format reference list (verified sources only) |
| [`docs/dataset.md`](docs/dataset.md) | Lexicon schema, sourcing, annotation, validation process |
| [`docs/dataset-licensing.md`](docs/dataset-licensing.md) | What must be resolved before ingesting copyrighted dictionary text |
| [`docs/evaluation-plan.md`](docs/evaluation-plan.md) | Metrics, baseline comparison, result table templates |

## API

`GET /suggest?word=<word>&context=<optional sentence>&max_cost=2.0&top_k=3`

Returns `{ input_word, message, suggestions[], explanations[] }`. See
`backend/app/main.py` for the full contract; FastAPI also serves
interactive docs at `/docs` when the server is running.

## License

Code: MIT (`LICENSE`). Dataset: not yet finalized — see
`docs/dataset-licensing.md` before contributing sourced dictionary
content.

## Contributing

See `CONTRIBUTING.md`. Native-speaker review of the (currently
unvalidated) lexicon entries is the highest-priority open task.

## Release plan

- **v0.1 (current)**: pipeline scaffold, illustrative unvalidated
  lexicon, Word Add-in scaffold, architecture/algorithm docs.
- **v0.2**: native-speaker-validated lexicon of meaningful size (target
  TBD once annotation capacity is confirmed); BK-tree / n-gram index
  replacing brute-force candidate search.
- **v0.3**: evaluation results (Tables 5–7) against the plain-edit-
  distance baseline on a real test set; manuscript draft.
- **v1.0**: packaged Word Add-in (icons, production API deployment,
  AppSource or centralized-deployment submission).
