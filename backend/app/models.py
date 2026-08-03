"""SQLAlchemy schema for the Afaan Oromo lexical database (see Table 3,
docs/dataset.md for the full field-by-field rationale)."""

from __future__ import annotations

from sqlalchemy import Boolean, Column, Integer, String
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class LexicalEntry(Base):
    __tablename__ = "lexical_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    word = Column(String, nullable=False, index=True)
    lemma = Column(String, nullable=False, index=True)
    meaning = Column(String, nullable=False)
    pos = Column(String, nullable=False)  # part of speech
    category = Column(String, nullable=False)  # semantic/word category
    related_words = Column(String, default="")  # ';'-delimited word list
    variants = Column(String, default="")  # ';'-delimited spelling variants
    examples = Column(String, default="")
    frequency_rank = Column(Integer, default=100000)  # lower = more frequent
    validated = Column(Boolean, default=False)  # native-speaker validation flag

    def related_words_list(self) -> list[str]:
        return [w for w in (self.related_words or "").split(";") if w]

    def __repr__(self) -> str:  # pragma: no cover
        return f"<LexicalEntry {self.word!r} = {self.meaning!r}>"
