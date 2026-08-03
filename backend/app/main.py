"""FastAPI backend for the Afaan Oromo spelling-assistance service.

Pipeline: word identification (client-side, plugin) -> dictionary lookup
-> orthographic similarity search -> candidate generation -> ranking ->
meaning retrieval -> suggestion generation -> explanation.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import candidate_generation as cg
from . import ranking as rk
from .db import DEFAULT_SEED_CSV, get_session, seed_from_csv
from .explain import build_suggestions, render_explanations, render_message
from .models import LexicalEntry


@asynccontextmanager
async def lifespan(_: FastAPI):
    session = get_session()
    if session.query(LexicalEntry).count() == 0:
        seed_from_csv(session, DEFAULT_SEED_CSV)
    session.close()
    yield


app = FastAPI(
    title="Afaan Oromo Spelling Assistance API",
    description="Semantically informed spelling assistance: orthographic "
    "similarity search + lexical disambiguation for Afaan Oromo.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tightened at deployment time to the Office Add-in origin
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class SuggestionOut(BaseModel):
    word: str
    meaning: str
    pos: str
    explanation: str
    score: float


class SuggestResponse(BaseModel):
    input_word: str
    message: str
    suggestions: list[SuggestionOut]
    explanations: list[str]


def _load_vocabulary_and_entries() -> tuple[list[str], dict[str, LexicalEntry]]:
    session = get_session()
    entries = session.query(LexicalEntry).all()
    vocabulary = [e.word for e in entries]
    entries_by_word = {e.word: e for e in entries}
    session.close()
    return vocabulary, entries_by_word


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/suggest", response_model=SuggestResponse)
def suggest(
    word: str = Query(..., description="Afaan Oromo word typed by the user"),
    context: str | None = Query(None, description="Surrounding sentence, for semantic disambiguation"),
    max_cost: float = Query(2.0, description="Maximum weighted edit distance to search"),
    top_k: int = Query(3, description="Number of suggestions to return"),
) -> SuggestResponse:
    vocabulary, entries_by_word = _load_vocabulary_and_entries()

    candidates = cg.generate_candidates(word, vocabulary, max_cost=max_cost)
    ranked = rk.rank_candidates(candidates, entries_by_word, context=context)
    candidates_by_word = {c.word: c for c in candidates}
    suggestions = build_suggestions(ranked, candidates_by_word, top_k=top_k)

    return SuggestResponse(
        input_word=word,
        message=render_message(word, suggestions),
        suggestions=[SuggestionOut(**vars(s)) for s in suggestions],
        explanations=render_explanations(suggestions),
    )
