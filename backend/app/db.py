"""SQLite session management and CSV-based seed loading."""

from __future__ import annotations

import csv
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from .models import Base, LexicalEntry

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "lexicon.db"
DEFAULT_SEED_CSV = Path(__file__).resolve().parent.parent.parent / "dataset" / "lexicon_seed.csv"


def make_engine(db_path: Path = DEFAULT_DB_PATH):
    return create_engine(f"sqlite:///{db_path}", future=True)


def make_session_factory(engine) -> sessionmaker:
    return sessionmaker(bind=engine, future=True)


def init_db(engine) -> None:
    Base.metadata.create_all(engine)


def seed_from_csv(session: Session, csv_path: Path = DEFAULT_SEED_CSV) -> int:
    """Load the lexicon CSV into the database. Idempotent: clears existing
    rows first so re-running the loader is safe during development."""
    session.query(LexicalEntry).delete()
    count = 0
    with open(csv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            entry = LexicalEntry(
                word=row["word"].strip(),
                lemma=row["lemma"].strip(),
                meaning=row["meaning"].strip(),
                pos=row["pos"].strip(),
                category=row["category"].strip(),
                related_words=row.get("related_words", "").strip(),
                variants=row.get("variants", "").strip(),
                examples=row.get("examples", "").strip(),
                frequency_rank=int(row.get("frequency_rank") or 100000),
                validated=(row.get("validated", "false").strip().lower() == "true"),
            )
            session.add(entry)
            count += 1
    session.commit()
    return count


def get_session(db_path: Path = DEFAULT_DB_PATH) -> Session:
    engine = make_engine(db_path)
    init_db(engine)
    factory = make_session_factory(engine)
    return factory()
