"""
Afaan Oromo (Qubee) phonemic tokenizer.

Segments a Qubee-orthography word into the units that carry independent
phonemic/lexical weight in Afaan Oromo: digraphs, long (geminate) vowels,
geminate consonants, and single graphemes.

Linguistic basis (see docs/linguistic-background.md for full citations):
  - Digraphs (dh, ch, ny, sh, ts, ph) each represent a single consonant
    phoneme not present as a plain Latin letter.
  - Vowel length is contrastive and marked orthographically by doubling
    (a/aa, e/ee, i/ii, o/oo, u/uu), e.g. dhuga "drink" vs dhugaa "truth".
  - Consonant gemination is contrastive and marked by doubling, e.g.
    gadaa "Gadaa system" vs gadda "sadness/grief"; badaa "bad" vs
    baddaa "highland".

The tokenizer is greedy and left-to-right, matching the longest
phonemically meaningful unit at each position. This ordering
(digraph > long vowel / geminate consonant > single grapheme) is what
reproduces the reference segmentation "sanyi" -> s | a | ny | i.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

VOWELS = set("aeiou")
CONSONANTS = set("bcdfghjklmnpqrstvwxyz")

# Digraphs represent a single Oromo consonant phoneme (Qubee orthography).
# ph is included for loanword/orthographic-variant coverage.
DIGRAPHS = {"dh", "ch", "ny", "sh", "ts", "ph"}


class TokenClass(str, Enum):
    DIGRAPH = "digraph"
    LONG_VOWEL = "long_vowel"
    GEMINATE = "geminate"
    SHORT_VOWEL = "short_vowel"
    CONSONANT = "consonant"
    OTHER = "other"


@dataclass(frozen=True)
class Token:
    surface: str
    cls: TokenClass

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return f"{self.surface}:{self.cls.value}"


def tokenize(word: str) -> list[Token]:
    """Segment a Qubee word into phonemically meaningful tokens.

    >>> [t.surface for t in tokenize("sanyi")]
    ['s', 'a', 'ny', 'i']
    >>> [t.surface for t in tokenize("dhugaa")]
    ['dh', 'u', 'g', 'aa']
    >>> [t.surface for t in tokenize("gadda")]
    ['g', 'a', 'dd', 'a']
    """
    w = word.strip()
    n = len(w)
    tokens: list[Token] = []
    i = 0
    while i < n:
        pair = w[i : i + 2].lower()
        if len(pair) == 2 and pair in DIGRAPHS:
            tokens.append(Token(w[i : i + 2], TokenClass.DIGRAPH))
            i += 2
            continue
        if len(pair) == 2 and pair[0] == pair[1] and pair[0] in VOWELS:
            tokens.append(Token(w[i : i + 2], TokenClass.LONG_VOWEL))
            i += 2
            continue
        if len(pair) == 2 and pair[0] == pair[1] and pair[0] in CONSONANTS:
            tokens.append(Token(w[i : i + 2], TokenClass.GEMINATE))
            i += 2
            continue
        ch = w[i].lower()
        if ch in VOWELS:
            tokens.append(Token(w[i], TokenClass.SHORT_VOWEL))
        elif ch in CONSONANTS:
            tokens.append(Token(w[i], TokenClass.CONSONANT))
        else:
            tokens.append(Token(w[i], TokenClass.OTHER))
        i += 1
    return tokens


def base_letter(token: Token) -> str:
    """The single-letter root of a token, used to compare a token against
    its short/geminate or short/long counterpart (e.g. 'aa' -> 'a')."""
    return token.surface[0].lower()


def is_vowel_length_pair(a: Token, b: Token) -> bool:
    """True if a and b are the short/long form of the same vowel."""
    if {a.cls, b.cls} <= {TokenClass.SHORT_VOWEL, TokenClass.LONG_VOWEL} and a.cls != b.cls:
        return base_letter(a) == base_letter(b)
    return False


def is_gemination_pair(a: Token, b: Token) -> bool:
    """True if a and b are the short/geminate form of the same consonant."""
    if {a.cls, b.cls} <= {TokenClass.CONSONANT, TokenClass.GEMINATE} and a.cls != b.cls:
        return base_letter(a) == base_letter(b)
    return False


def is_digraph_confusion(a: Token, b: Token) -> bool:
    """True if a and b are a digraph and its first (or matching) plain
    consonant, e.g. 'dh' vs 'd', or 'sh' vs 's' — a common typing slip
    when a digraph is under-typed."""
    if a.cls == TokenClass.DIGRAPH and b.cls == TokenClass.CONSONANT:
        return a.surface[0].lower() == b.surface.lower()
    if b.cls == TokenClass.DIGRAPH and a.cls == TokenClass.CONSONANT:
        return b.surface[0].lower() == a.surface.lower()
    return False
