# Contributing

Thanks for your interest in the Afaan Oromo Spelling Assistance project.

## Ways to contribute

- **Native-speaker validation**: the seed lexicon (`dataset/lexicon_seed.csv`)
  is unvalidated (`validated=false` on every row). Reviewing an entry's
  gloss/POS/example and opening a PR that flips it to `true` (or
  corrects it) is one of the highest-value contributions right now.
- **New lexicon entries**, especially additional minimal/near-minimal
  pairs (vowel-length, gemination, digraph-confusion) beyond the seed
  set — see `docs/dataset.md` for the annotation process.
- **Backend**: `backend/app/` — candidate generation, ranking,
  explanation generation. See `docs/algorithms.md` for the specified
  behavior and `backend/tests/` for the contract each module must meet.
- **Frontend**: `frontend/` — the Word Add-in task pane.
- **Evaluation**: implementing the metrics/tables in
  `docs/evaluation-plan.md` against a real validated test set.

## Development setup

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest -q
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev-server   # serves the task pane at https://localhost:3000
npm run start        # sideloads the add-in into Word (requires Office)
```

## Pull requests

- Keep PRs scoped to one concern (one algorithm change, one doc, one
  dataset batch) — this is a research codebase where reviewers need to
  reason about correctness of small, well-defined changes.
- Add/update tests for any change to `backend/app/phonology.py`,
  `candidate_generation.py`, or `ranking.py` — these encode linguistic
  claims that must stay verifiably correct.
- If a change touches a linguistic rule (a new digraph, a new gemination
  case, etc.), cite a source in `docs/references.md` and update
  `docs/linguistic-background.md` — do not add uncited orthographic
  claims.

## Code of conduct

Be respectful and assume good faith, especially in discussions involving
language data from native-speaker contributors. This project exists to
serve Afaan Oromo speakers; contributions that don't reflect that should
be flagged in review.
