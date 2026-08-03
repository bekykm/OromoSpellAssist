# Dataset Licensing (to resolve before ingesting real dictionary content)

The code in this repository is MIT-licensed (see `LICENSE`). **The
lexical dataset is a separate concern and must not inherit the code
license automatically.**

Before ingesting text from any published dictionary (e.g. Gragg's
*Oromo Dictionary* [1], or any other copyrighted print/digital
dictionary) into `dataset/`:

1. Confirm the source's copyright status and whether headword lists,
   glosses, or example sentences may be redistributed, and under what
   terms (open dictionaries such as Wiktionary/Glosbe entries may carry
   their own reuse license, e.g. CC-BY-SA, which is compatible with an
   open dataset release but requires attribution and share-alike; a
   commercial print dictionary generally is not redistributable without
   explicit permission).
2. If redistribution rights cannot be confirmed, do not commit the raw
   source text — instead keep a private, ungitted working copy and
   commit only derived annotations (e.g. `validated`, `category`) that
   do not reproduce the copyrighted gloss text verbatim, or seek
   written permission from the rights holder.
3. Record the license actually applied to `dataset/` (e.g. CC-BY 4.0 for
   data, distinct from the MIT code license) in this file once decided,
   and reference it from the top-level `README.md`.

This file intentionally has no license decision yet — the seed CSV
(`dataset/lexicon_seed.csv`) contains only the eight to ten illustrative
word pairs already given in the research design, authored directly for
this project, not extracted from a copyrighted dictionary.
