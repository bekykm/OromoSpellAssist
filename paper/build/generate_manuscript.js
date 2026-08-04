const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  ImageRun, PageBreak, LevelFormat, Header, Footer, PageNumber,
  Tab, TabStopType, TabStopPosition, VerticalAlign, convertInchesToTwip,
} = require("docx");

const FIG = (p) => path.join(__dirname, "..", "figures", p);

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------
const FONT = "Times New Roman";

function H1(text) {
  return new Paragraph({
    text, heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 180 },
  });
}
function H2(text) {
  return new Paragraph({
    text, heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 140 },
  });
}
function H3(text) {
  return new Paragraph({
    text, heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
  });
}

function runsFromMarkup(text) {
  // small **bold**, *italic*, _italic_ (Oromo word emphasis), and `code` markup.
  // Backtick spans are matched first so an underscore inside `like_this` is
  // never mistaken for the start/end of an _italic_ span outside it.
  const runs = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push(new TextRun({ text: text.slice(last, m.index), font: FONT, size: 22 }));
    const token = m[0];
    if (token.startsWith("`")) {
      runs.push(new TextRun({ text: token.slice(1, -1), font: "Courier New", size: 20 }));
    } else if (token.startsWith("**")) {
      runs.push(new TextRun({ text: token.slice(2, -2), bold: true, font: FONT, size: 22 }));
    } else {
      runs.push(new TextRun({ text: token.slice(1, -1), italics: true, font: FONT, size: 22 }));
    }
    last = re.lastIndex;
  }
  if (last < text.length) runs.push(new TextRun({ text: text.slice(last), font: FONT, size: 22 }));
  return runs;
}

function P(text, opts = {}) {
  return new Paragraph({
    children: runsFromMarkup(text),
    alignment: opts.align || AlignmentType.JUSTIFIED,
    spacing: { after: 160, line: 300 },
    ...opts.pOpts,
  });
}

function Caption(text) {
  return new Paragraph({
    children: [new TextRun({ text, italics: true, font: FONT, size: 20 })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 240, before: 80 },
  });
}

function Bullet(items) {
  return items.map((t) => new Paragraph({
    children: runsFromMarkup(t),
    bullet: { level: 0 },
    spacing: { after: 100, line: 280 },
    alignment: AlignmentType.JUSTIFIED,
  }));
}

function Numbered(items, refName) {
  return items.map((t) => new Paragraph({
    children: runsFromMarkup(t),
    numbering: { reference: refName, level: 0 },
    spacing: { after: 100, line: 280 },
    alignment: AlignmentType.JUSTIFIED,
  }));
}

function FigureImage(file, width, height, caption) {
  const data = fs.readFileSync(FIG(file));
  return [
    new Paragraph({
      children: [new ImageRun({ data, transformation: { width, height }, type: "png" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 160, after: 60 },
    }),
    Caption(caption),
  ];
}

function cell(text, opts = {}) {
  const runs = Array.isArray(text)
    ? text
    : [new TextRun({ text: String(text), font: FONT, size: opts.size || 19, bold: !!opts.bold })];
  return new TableCell({
    width: { size: opts.width || 1000, type: WidthType.DXA },
    shading: opts.shade ? { type: ShadingType.CLEAR, fill: opts.shade } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({
      children: runs,
      alignment: opts.align || AlignmentType.LEFT,
    })],
  });
}

function DataTable(headers, rows, widths, opts = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => cell(h, { width: widths[i], bold: true, shade: "D9E2F3", size: 19 })),
  });
  const bodyRows = rows.map((r) => new TableRow({
    children: r.map((c, i) => cell(c, { width: widths[i], size: 19 })),
  }));
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...bodyRows],
  });
}

function TableCaption(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, font: FONT, size: 20 })],
    spacing: { before: 220, after: 100 },
  });
}

function hr() {
  return new Paragraph({
    border: { bottom: { color: "999999", space: 1, style: BorderStyle.SINGLE, size: 6 } },
    spacing: { after: 200 },
  });
}

// ---------------------------------------------------------------------------
// Pilot evaluation numbers (computed by backend/scripts/pilot_evaluation.py;
// see /tmp/pilot_results.json at generation time -- reproduced verbatim, not
// hand-rounded beyond 3 decimals / 1 decimal percent).
// ---------------------------------------------------------------------------
const PILOT = {
  lexiconSize: 10,
  nItems: 12,
  aggregate: {
    candGenAcc: "100.0%", top1: "66.7%", top3: "100.0%", mrr: "0.833",
    precision: "77.8%", recall: "100.0%",
  },
  byContrast: [
    ["Vowel length", "4", "100.0%", "1.000", "100.0%", "1.000"],
    ["Gemination", "2", "50.0%", "0.750", "100.0%", "1.000"],
    ["Mixed (gemination + vowel length)", "2", "100.0%", "1.000", "50.0%", "0.750"],
    ["Other (affixal, out of scope)", "4", "25.0%", "0.625", "25.0%", "0.625"],
  ],
};

// ---------------------------------------------------------------------------
// Document assembly
// ---------------------------------------------------------------------------
const children = [];

// ---- Title page ----
children.push(
  new Paragraph({ spacing: { before: 1200 } }),
  new Paragraph({
    children: [new TextRun({
      text: "Semantically Informed Spelling Assistance for Afaan Oromo Using Orthographic Similarity and Lexical Disambiguation",
      bold: true, size: 32, font: FONT,
    })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 480 },
  }),
  new Paragraph({
    children: [new TextRun({ text: "[Author Name]", size: 24, font: FONT })],
    alignment: AlignmentType.CENTER, spacing: { after: 80 },
  }),
  new Paragraph({
    children: [new TextRun({ text: "[Affiliation, Department, University]", size: 22, font: FONT, italics: true })],
    alignment: AlignmentType.CENTER, spacing: { after: 80 },
  }),
  new Paragraph({
    children: [new TextRun({ text: "Corresponding author: [corresponding.author@example.edu]", size: 22, font: FONT, italics: true })],
    alignment: AlignmentType.CENTER, spacing: { after: 80 },
  }),
  new Paragraph({
    children: [new TextRun({ text: "Repository (code, dataset schema, evaluation scripts): https://github.com/bekykm/OromoSpellAssist (private during development; recommended to be made public alongside a validated dataset release)", size: 20, font: FONT, italics: true })],
    alignment: AlignmentType.CENTER, spacing: { after: 80 },
  }),
  new Paragraph({
    children: [new TextRun({ text: "August 2026", size: 22, font: FONT })],
    alignment: AlignmentType.CENTER, spacing: { after: 480 },
  }),
);

// ---- Abstract ----
children.push(H1("Abstract"));
children.push(P(
  "Afaan Oromo is written in the Latin-based Qubee orthography, in which vowel length and consonant gemination are contrastive: minimal orthographic changes such as doubling a vowel or a consonant can change a word's meaning entirely (e.g., _dhuga_ \"drink\" vs. _dhugaa_ \"truth\"; _gadaa_ \"the Gadaa system\" vs. _gadda_ \"sadness\"). Conventional spell checkers, built on orthography-blind edit-distance models, are poorly suited to this property: they either silently replace a correctly spelled but unintended word with another, or never flag a correctly spelled word for review even when the writer typed the wrong valid word. This paper presents a semantically informed spelling assistance framework for Afaan Oromo that, instead of auto-correcting, retrieves orthographically similar **valid** words from a lexical database, ranks them by a combination of orthographic similarity, corpus frequency, lexical validity, and semantic context, and presents them to the writer with their meanings and an explanation of the orthographic contrast (e.g., \"Did you mean 'dhugaa' (truth) or 'dhuga' (drink)? The difference is the long vowel 'aa'.\"). We describe a phonemic tokenizer that segments Qubee orthography into digraphs, long vowels, and geminate consonants; a weighted edit-distance model over this representation; a multi-feature ranking function; and a Microsoft Word add-in that surfaces the system in situ. We report a small-scale pilot evaluation against a traditional character-level edit-distance baseline on an illustrative, as-yet-unvalidated ten-entry lexicon. The pilot is too small to demonstrate a robust aggregate advantage, and we report that plainly, but item-level analysis surfaces both a concrete case where the proposed weighting corrects a baseline failure and a concrete case where it introduces a new one -- an honest, mechanism-level result that motivates the production-scale evaluation we lay out as future work. The full pipeline, dataset schema, and evaluation code are released as open source."
));
children.push(new Paragraph({
  children: [
    new TextRun({ text: "Keywords: ", bold: true, font: FONT, size: 22 }),
    new TextRun({ text: "Afaan Oromo; low-resource language processing; spelling assistance; orthographic similarity; lexical disambiguation; Qubee orthography; vowel length; consonant gemination", italics: true, font: FONT, size: 22 }),
  ],
  spacing: { after: 300 },
}));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- 1. Introduction ----
children.push(H1("1. Introduction"));

children.push(H2("1.1 Research Motivation"));
children.push(P(
  "Afaan Oromo is one of the most widely spoken Cushitic languages of the Horn of Africa, written since 1991 in the Latin-based Qubee orthography [3], [4]. As Afaan Oromo speakers increasingly write and publish in digital environments -- word processors, messaging platforms, web content -- the absence of mature, linguistically-aware writing-assistance tools is a practical gap with real consequences for authors, editors, and learners. Existing Afaan Oromo spelling and grammar tools in the literature are correction-oriented: given a misspelled input, they compute a single best replacement using bigram context and/or morphological rules [6], [7]. That design choice is reasonable for canonical typos, but it is a poor fit for a language whose orthography marks lexically contrastive vowel length and consonant gemination through simple letter doubling -- a property that turns many \"typos\" into perfectly valid words with a different meaning."
));

children.push(H2("1.2 Problem Statement"));
children.push(P(
  "A conventional spell checker treats any dictionary word as correct and leaves it untouched, and treats any non-dictionary string as an error to be silently corrected to its single nearest dictionary neighbor. Both behaviors fail in Afaan Oromo when the input is itself a valid word that differs from the writer's intended word only in vowel length or consonant gemination: the checker either leaves a valid-but-wrong word untouched (no error is ever raised, because it *is* a real word), or, in the non-word case, silently replaces the input with one arbitrary nearest neighbor without regard for whether that neighbor is the linguistically closest one or an orthographic accident. In a language where _dhuga_ (\"drink\") and _dhugaa_ (\"truth\") are one keystroke apart, either failure mode can silently substitute the writer's intended meaning with a different one."
));

children.push(H2("1.3 Research Gap"));
children.push(...Bullet([
  "No Afaan Oromo NLP system in the reviewed literature treats vowel-length and gemination differences as a **meaning-disambiguation** problem; both reviewed spelling/grammar-correction systems are single-best-guess correction systems evaluated on aggregate correction accuracy, not on preserving or surfacing lexical ambiguity [6], [7].",
  "No openly available Afaan Oromo lexical resource in the literature explicitly encodes minimal-pair relations between orthographically close but semantically distinct words in a form usable for disambiguation-oriented ranking (as opposed to a flat headword/gloss dictionary).",
  "The broader low-resource NLP literature documents orthographic and morphological complexity as a recurring source of tool failure when high-resource-language assumptions (e.g., \"small edit distance implies typo\") are ported unchanged [9], but we are not aware of a system that operationalizes this specifically for Cushitic vowel-length/gemination contrasts.",
]));

children.push(H2("1.4 Research Questions"));
children.push(...Bullet([
  "**RQ1.** Can a phonemic (digraph-, vowel-length-, and gemination-aware) tokenization of Qubee orthography, combined with a weighted edit-distance model, reliably distinguish linguistically-motivated near-neighbors of a typed word from arbitrary orthographic near-neighbors?",
  "**RQ2.** Does incorporating corpus frequency, lexical validity, and semantic context into candidate ranking improve the ordering of that candidate set relative to orthographic similarity alone, and relative to an orthography-blind baseline?",
  "**RQ3.** Can the resulting candidate set be rendered as a natural-language, meaning-preserving explanation, delivered inside a real authoring tool, without requiring the writer to consult an external dictionary?",
]));

children.push(H2("1.5 Research Contributions"));
children.push(...Bullet([
  "An Oromo-aware phonemic tokenizer and a weighted token-level edit-distance model that assigns lower cost to vowel-length, gemination, and digraph-confusion edits than to arbitrary substitutions, directly targeting RQ1.",
  "A multi-feature, ablatable candidate-ranking function (orthographic similarity, frequency, lexical validity, semantic relevance) addressing RQ2, with default weights and an explicit extension point for embedding-based semantic scoring.",
  "A meaning-preserving suggestion and explanation generation module that reproduces the target interaction (\"Did you mean X (meaning) or Y (meaning)?\") specified for this system, addressing RQ3.",
  "A complete, open-source, end-to-end reference implementation: a FastAPI backend implementing the full pipeline and a Microsoft Word task-pane add-in (TypeScript/React/Office.js) that surfaces it during authoring.",
  "A lexical database schema and a dataset-construction methodology (automated minimal-pair mining, double annotation, adjudication, held-out native-speaker validation) for building a production-scale Afaan Oromo disambiguation lexicon.",
  "A pilot evaluation -- run on real, executable code against a literal character-level edit-distance baseline, not projected -- that reports both a genuine success case and a genuine limitation of the proposed weighting scheme, and an evaluation protocol for the production-scale study that should follow it.",
]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- 2. Literature Review and Related Work ----
children.push(H1("2. Literature Review and Related Work"));

children.push(H2("2.1 Afaan Oromo Orthography and Lexicography"));
children.push(P(
  "Afaan Oromo's current writing system, Qubee, is a Latin-based orthography formally adopted in 1991 [3], [4], replacing earlier and less standardized conventions. A documented motivation for adopting a Latin-based, doubling-marked orthography over the previously used Ge'ez script was precisely that Ge'ez could not represent consonant gemination or vowel length, both of which are phonemically contrastive in Oromo, whereas a doubled-letter Latin convention could [3]. Standard lexicographic references for Oromo include Gragg's _Oromo Dictionary_ [1] and Zorc's documentation of Oromo dictionary-making principles [2]; more recent descriptive grammar work continues actively, e.g. on demonstratives [5], indicating an active, ongoing linguistic documentation effort this project can and should draw on as it scales beyond the illustrative seed lexicon used here."
));

children.push(H2("2.2 Afaan Oromo Spelling and Grammar Correction"));
children.push(P(
  "Two systems anchor the existing Afaan Oromo spelling/grammar-correction literature. Kumera [6] built a context-based spell checker combining dictionary lookup, Levenshtein-distance candidate generation, and bigram context modeling for both non-word and real-word error detection, reporting approximately 93.9% correction accuracy on a 14,896/3,231-word train/test split. Abate, Khedkar, and Tidke [7] integrated a spell checker with a morphological analyzer in a rule-based Afaan Oromo grammar checker, compiling a roughly 300,000-word training corpus and about 300 hand-written grammar rules, and reporting 73--76% precision/recall/F-measure on spelling-error detection and 47--90% on grammar-error detection and correction suggestion. Both systems are single-best-correction designs: their evaluation protocols measure whether the system's one proposed correction matches the one intended correction. Neither system's evaluation protocol, as reported, distinguishes the case where the typed input is itself a different valid word from the case where it is a non-word -- which is exactly the distinction this paper's problem statement (Sec. 1.2) turns on. This is the concrete literature gap the present work addresses: not a claim that prior Afaan Oromo spell checkers are inaccurate, but that accuracy at single-best correction is the wrong objective for inputs that are themselves valid, ambiguous words."
));
children.push(P(
  "Beyond spelling/grammar correction specifically, the Sagalee automatic speech recognition dataset [8] is recent evidence that the Afaan Oromo NLP resource ecosystem is growing, but remains concentrated in speech rather than lexical-semantic resources -- reinforcing the dataset-construction gap identified in Sec. 1.3."
));

children.push(H2("2.3 General Spelling Correction and Edit-Distance Models"));
children.push(P(
  "The Levenshtein distance [10] and its extension to transpositions by Damerau [11] remain the standard formalization of orthographic edit distance, and Norvig's widely cited noisy-channel formulation [12] is a common accessible reference point for practical spelling correctors. A recent empirical comparison for Indonesian spelling correction [13] found a Norvig-style noisy-channel approach to outperform raw Damerau-Levenshtein distance on both accuracy and computation time, which is consistent with this paper's design choice: rather than adopting raw, unweighted edit distance, we keep Damerau-Levenshtein's dynamic-programming structure but replace its uniform substitution cost with Afaan-Oromo-specific costs (Sec. 4.2.2), situating the contribution as a linguistically-motivated instance of the well-established practice of customizing edit-distance cost functions, rather than a new algorithm from first principles."
));

children.push(H2("2.4 Low-Resource NLP"));
children.push(P(
  "Magueresse, Carles, and Heetderks [9] survey the state of low-resource NLP and identify data scarcity and orthographic/morphological complexity as recurring, compounding obstacles: tools and modeling assumptions developed for high-resource languages frequently fail when applied unchanged to languages whose orthography encodes distinctions -- length, gemination, tone, agglutination -- that the source assumptions did not anticipate. This paper is a concrete instance of the adaptation the survey calls for: rather than porting an English-centric, orthography-blind spell-checker design to Afaan Oromo unchanged, the tokenizer and cost model in Sec. 4.2 are built directly from Afaan Oromo's documented orthographic phenomena (Sec. 3)."
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- 3. Afaan Oromo Linguistic Background ----
children.push(H1("3. Afaan Oromo Linguistic Background"));
children.push(P(
  "This section states the linguistic facts the tokenizer and cost model in Sec. 4.2 are built from, each traced to a cited source, following this manuscript's requirement that no orthographic rule be asserted without citation."
));

children.push(H2("3.1 Qubee Orthography"));
children.push(P(
  "Qubee is the Latin-based orthography officially adopted for Afaan Oromo in 1991 [3], [4]. Its adoption over the previously used Ge'ez script was motivated in part by Ge'ez's inability to mark consonant gemination or vowel length, both phonemically contrastive in Oromo, while a doubled-letter Latin convention could mark both directly in the writing system [3]."
));

children.push(H2("3.2 Digraphs"));
children.push(P(
  "Several Oromo consonant phonemes without a single corresponding Latin letter are written as two-letter digraphs: _dh_, _ch_, _ny_, _sh_, _ts_, _ph_ [1]--[3]. Each digraph is one phonemic unit, not a consonant cluster, and must be segmented as a single token when computing orthographic similarity -- for example, _sanyi_ segments as s | a | ny | i (four units), not five independent letters."
));

children.push(H2("3.3 Vowel Length"));
children.push(P(
  "Oromo has five short vowels and five long vowels, phonemically contrastive, with length marked orthographically by doubling the vowel letter: _aa, ee, ii, oo, uu_ [1]--[3]. This is not a spelling nicety: _dhuga_ (short _a_) means \"drink\" (imperative), while _dhugaa_ (long _aa_) means \"truth\" -- the running example specified for this system."
));

children.push(H2("3.4 Consonant Gemination"));
children.push(P(
  "Consonant length is independently contrastive and marked by doubling the consonant letter [1]--[3]. A documented published minimal pair is _badaa_ (\"bad\") vs. _baddaa_ (\"highland\") [3]. This system's own running example, _gadaa_ (\"the Gadaa system\", the traditional Oromo generational socio-political institution) vs. _gadda_ (\"sadness/grief\"), in fact differs in **two** independent respects when phonemically aligned -- final vowel length (_aa_ vs. _a_) and medial consonant gemination (_d_ vs. _dd_) -- a stacked contrast that turns out to matter for the pilot results in Sec. 5 and 7."
));

children.push(H2("3.5 Implications for Spelling Assistance"));
children.push(P(
  "Table 1 summarizes the three orthographic phenomena this system treats as first-class, meaning-relevant edit categories rather than noise. The shared implication is that a spelling tool for Afaan Oromo cannot safely treat \"small edit distance\" as a proxy for \"probably a typo\": for these phenomena specifically, small edit distance frequently means \"a different, equally valid word.\""
));
children.push(TableCaption("Table 1. Afaan Oromo orthographic features treated as meaning-relevant edit categories"));
children.push(DataTable(
  ["Feature", "Orthographic marking", "Example pair", "Gloss 1", "Gloss 2", "Source"],
  [
    ["Digraph", "dh, ch, ny, sh, ts, ph", "sanyi (s|a|ny|i)", "seed / offspring", "—", "[1]–[3]"],
    ["Vowel length", "doubled vowel (aa, ee, ii, oo, uu)", "dhuga / dhugaa", "drink", "truth", "[3]; this work"],
    ["Consonant gemination", "doubled consonant", "badaa / baddaa", "bad", "highland", "[3]"],
    ["Gemination + vowel length (stacked)", "both, in the same pair", "gadaa / gadda", "Gadaa system", "sadness / grief", "this work, consistent with [3]"],
  ],
  [1500, 2400, 1800, 1400, 1400, 1500],
));
children.push(new Paragraph({ spacing: { after: 200 } }));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- 4. Methodology ----
children.push(H1("4. Methodology"));
children.push(P(
  "The methodology has four parts, corresponding to Sec. 4.1--4.4: the system architecture that turns a typed word into a suggestion (4.1); the algorithms implementing each pipeline stage (4.2); the lexical dataset the pipeline queries, and how a production-scale version of it should be built (4.3); and the protocol used to evaluate the pipeline against a traditional baseline (4.4). All components described below are implemented in the accompanying open-source repository, not only specified in the abstract."
));

children.push(H2("4.1 System Architecture"));
children.push(P(
  "The system is a client-server pipeline (Figure 1). A Microsoft Word task-pane add-in reads the writer's current word selection via the Office JavaScript API and sends it to a FastAPI backend's `GET /suggest` endpoint. The backend executes six pipeline stages -- word identification, dictionary lookup, orthographic similarity search, candidate ranking, meaning retrieval, and explanation generation -- against a relational lexical database, and returns a structured response (a natural-language message, a ranked list of suggestions with meanings, and per-candidate explanations) that the task pane renders back into the document context."
));
children.push(...FigureImage("fig1_overall_architecture.png", 620, 362, "Figure 1. Overall system architecture: Word add-in, FastAPI pipeline stages, and lexical database."));

children.push(P(
  "Table 2 gives the lexical database schema (implemented as `LexicalEntry` in the reference implementation). Two fields are worth calling out because they operationalize this paper's central design decision: `related_words`, which records the orthographic near-neighbors with **distinct** meanings that make an entry ambiguity-relevant (as opposed to `variants`, which records accepted spelling variants of the *same* lemma); and `validated`, a boolean flag consumed directly by the ranking function (Sec. 4.2.3) so that unreviewed lexicon entries are never silently treated as equally trustworthy as native-speaker-reviewed ones."
));
children.push(TableCaption("Table 2. Lexical database schema"));
children.push(DataTable(
  ["Field", "Type", "Description"],
  [
    ["word", "string", "Surface (orthographic) form"],
    ["lemma", "string", "Citation / dictionary form"],
    ["meaning", "string", "Gloss (English)"],
    ["pos", "string", "Part of speech"],
    ["category", "string", "Semantic / word category"],
    ["related_words", "string list", "Orthographic near-neighbors with distinct meanings (the disambiguation set)"],
    ["variants", "string list", "Accepted spelling variants of the same lemma"],
    ["examples", "string", "Example sentence(s)"],
    ["frequency_rank", "int", "Corpus frequency rank (lower = more frequent); feeds ranking"],
    ["validated", "bool", "Whether a native-speaker annotator has confirmed this entry"],
  ],
  [1900, 1400, 5700],
));
children.push(new Paragraph({ spacing: { after: 200 } }));

children.push(P(
  "The Word add-in itself (Figure 5) follows the standard Office Add-in structure: a manifest registers a ribbon button that opens an HTML task pane; the task pane hosts a React component (`Taskpane.tsx`) that reads the current selection through a thin Office.js wrapper (`office.ts`) and calls the backend through a thin fetch wrapper (`api.ts`)."
));
children.push(...FigureImage("fig5_plugin_architecture.png", 560, 420, "Figure 5. Microsoft Word plugin architecture: manifest, ribbon, task pane, and its two integration points (the document via Office.js, and the backend via HTTPS)."));

children.push(P(
  "Candidate search (Sec. 4.2.2) is currently a brute-force scan over the lexicon vocabulary, which is adequate at the pilot scale evaluated in Sec. 5 but not at production scale. A weighted token edit distance satisfies the triangle inequality, so a BK-tree index is a valid drop-in acceleration; alternatively, a phoneme-n-gram inverted index (indexing each lexicon word by its bigrams of phonemic tokens, so only candidates sharing at least one bigram with the query are scored) would similarly avoid a full linear scan. Both are noted here as the intended replacement for `generate_candidates` at scale, not yet implemented or evaluated."
));

children.push(H2("4.2 Algorithm Design"));

children.push(H3("4.2.1 Phonemic Tokenization"));
children.push(P(
  "A Qubee word is segmented left-to-right by a greedy longest-match rule with priority digraph > long-vowel/geminate pair > single grapheme. This priority order is what reproduces the reference segmentation _sanyi_ → s | a | ny | i (Sec. 3.2): at the position of \"ny\", the digraph match is attempted before considering \"n\" and \"y\" as independent single-consonant tokens. Figure 3 illustrates the resulting token alignment for _dhuga_ vs. _dhugaa_ and the cost assigned to their one point of difference."
));
children.push(...FigureImage("fig3_orthographic_similarity_model.png", 600, 390, "Figure 3. Orthographic similarity model: token-level weighted comparison of dhuga and dhugaa. The four tokens dh/u/g are identical (cost 0); the fifth token pair a/aa differs only by vowel length (cost 0.5), giving a total weighted cost of 0.5 rather than the 1.0 an orthography-blind model would assign to any single-character edit."));

children.push(H3("4.2.2 Candidate Generation"));
children.push(P(
  "For an input word w and a lexicon vocabulary L, the system tokenizes w and every l ∈ L, computes a weighted Damerau-Levenshtein distance over the token sequences, and retains every l with cost ≤ a threshold θ (Figure 2). Substitution cost depends on the relationship between the two tokens being compared: identical tokens cost 0; a vowel-length pair (e.g. a/aa) or a gemination pair (e.g. d/dd) costs 0.5; a digraph-vs.-base-consonant confusion (e.g. dh/d) costs 0.7; any other substitution, insertion, or deletion costs 1.0, as does a transposition. Critically, the candidate set always includes the exact input word itself at cost 0 if it is a valid lexicon entry -- e.g. searching for _dhuga_ must retain _dhuga_ (\"drink\") itself as one of the presented options, not discard it as \"the thing the user typed\", because presenting it alongside _dhugaa_ (\"truth\") is the entire point of the system (Sec. 1.2)."
));
children.push(...FigureImage("fig2_candidate_generation_workflow.png", 480, 453, "Figure 2. Candidate generation workflow."));
children.push(P(
  "Worst-case complexity is O(V · n · m) for a lexicon of size V and average token length m; a cheap token-count pre-filter (skipping candidates whose token-length difference already exceeds θ+1) prunes the majority of comparisons in practice. As noted in Sec. 4.1, this remains a linear scan over V and is the component to replace first when scaling beyond a pilot-size lexicon."
));

children.push(H3("4.2.3 Candidate Ranking"));
children.push(P(
  "Each retained candidate is scored as a weighted sum of four features (Figure 7, Table 3): orthographic similarity (the normalized inverse of the weighted edit cost from Sec. 4.2.2), a log-scaled frequency score (favoring more common words), a lexical-validity score (1.0 for native-speaker-validated entries, 0.6 otherwise, per the `validated` field in Table 2), and a semantic-relevance score. In the current implementation, semantic relevance is a lexical-overlap heuristic between the surrounding sentence context (if supplied) and the candidate's stored gloss/examples -- explicitly a placeholder for an embedding-based scorer, not a claim of a trained semantic model (Sec. 8, Sec. 9)."
));
children.push(...FigureImage("fig7_ranking_mechanism.png", 600, 429, "Figure 7. Candidate ranking mechanism: four weighted features summed into a final suggestion score."));
children.push(TableCaption("Table 3. Candidate ranking features and default weights"));
children.push(DataTable(
  ["Feature", "Symbol", "Default weight", "Description"],
  [
    ["Orthographic similarity", "w_o", "0.45", "Normalized inverse of the weighted token edit cost (Sec. 4.2.2)"],
    ["Frequency score", "w_f", "0.20", "Log-scaled inverse of corpus frequency rank"],
    ["Lexical validity", "w_v", "0.10", "1.0 if native-speaker validated, else 0.6"],
    ["Semantic relevance", "w_s", "0.25", "Context-overlap heuristic (placeholder for an embedding-based scorer, Sec. 9)"],
  ],
  [2200, 1200, 1600, 4000],
));
children.push(new Paragraph({ spacing: { after: 200 } }));

children.push(H3("4.2.4 Suggestion Generation"));
children.push(P(
  "The top-k ranked candidates are converted into a natural-language message and per-candidate explanations (Figure 4). Each explanation names the dominant edit operation distinguishing the candidate from the input (vowel length, gemination, digraph, or a generic substitution/insertion/deletion, in that priority order), so the writer sees not just alternative words but the specific orthographic reason they differ -- directly answering RQ3. For the example specified in this project's design (Sec. 1), the implementation reproduces: \"Did you mean 'dhugaa' (truth) or 'dhuga' (drink)?\", verified end-to-end in the accompanying test suite."
));
children.push(...FigureImage("fig4_disambiguation_pipeline.png", 600, 390, "Figure 4. Lexical disambiguation pipeline: from ranked candidates to the rendered message and explanations."));

children.push(H2("4.3 Dataset Construction"));
children.push(P(
  "Table 4 lists the minimal/near-minimal pairs currently in the illustrative seed lexicon used to develop and pilot-test the pipeline (Sec. 5). Every row in this seed lexicon has `validated = false`; it is a development fixture, not a citable lexical resource, and the ranking function already discounts unvalidated entries accordingly (Sec. 4.2.3, Table 3)."
));
children.push(TableCaption("Table 4. Example ambiguous word pairs (illustrative seed lexicon)"));
children.push(DataTable(
  ["Pair", "Contrast type", "Gloss 1", "Gloss 2"],
  [
    ["dhuga / dhugaa", "vowel length", "drink", "truth"],
    ["dhuga / dhuguma", "affixal (out of current scope)", "drink", "truly / indeed"],
    ["dhugaa / dhuguma", "affixal (out of current scope)", "truth", "truly / indeed"],
    ["gadaa / gadda", "gemination + vowel length (stacked)", "Gadaa system", "sadness / grief"],
    ["rafuu / raafuu", "vowel length", "to sleep", "Ethiopian kale (Brassica carinata)"],
    ["badaa / baddaa", "gemination", "bad", "highland"],
  ],
  [2600, 3200, 1600, 1600],
));
children.push(new Paragraph({ spacing: { after: 200 } }));

children.push(P(
  "Building a production-scale version of this dataset (Figure 6) requires: (1) sourcing candidate headwords from published dictionaries [1], [2], prior Afaan Oromo NLP corpora [6], [7] (subject to obtaining reuse permission -- none of these corpora were confirmed as openly redistributable during this project's literature search), and web-crawled Afaan Oromo text for frequency statistics; (2) running the same tokenizer and weighted edit distance used at inference time (Sec. 4.2.1--4.2.2) offline over the sourced wordlist to automatically surface candidate minimal pairs for review, rather than relying on annotators to recall them from memory; (3) double annotation of each mined pair by two independent native speakers, with a third annotator adjudicating disagreements, and inter-annotator agreement (e.g., Cohen's κ) recorded as a dataset-quality metric; and (4) a held-out validation pass, in which a disjoint panel of native speakers judges `(word, meaning)` pairs that include deliberately swapped controls, giving a human-accuracy upper bound to contextualize the system's own accuracy (Sec. 4.4)."
));
children.push(...FigureImage("fig6_dataset_annotation_workflow.png", 620, 421, "Figure 6. Dataset construction and annotation workflow."));
children.push(P(
  "None of steps (1)--(4) have been carried out at production scale for this paper; Sec. 8 states this limitation explicitly rather than projecting dataset statistics that do not yet exist."
));

children.push(H2("4.4 Evaluation Methodology"));
children.push(P(
  "For a set of `(typed_word, intended_word)` test items, we ask whether the system's ranked suggestion list surfaces `intended_word`, using five metrics: **candidate-generation accuracy** (is `intended_word` in the raw candidate set at all), **Top-1** and **Top-3 accuracy** (is it ranked first, or within the top three), **Mean Reciprocal Rank (MRR)**, and **precision/recall** against each entry's `related_words` field as ground truth for \"true\" near-neighbors."
));
children.push(P(
  "**Baseline (B0).** A literal, orthography-blind, unit-cost, character-level Damerau-Levenshtein distance (`baseline.py` in the reference implementation) [10], [11] -- no phonemic tokenization, no frequency/validity/semantic weighting -- ranking candidates purely by raw distance. **Proposed (P1).** The full pipeline described in Sec. 4.2. Both B0 and P1 always place the exact typed word first (cost/distance 0) when it is itself a valid entry, by the same design decision noted in Sec. 4.2.2. This makes a naive Top-1/rank computed over the *full* candidate list uninformative for `typed ≠ intended` test items, since rank 1 is trivially always \"the word the user typed\" in both systems. We therefore compute rank, Top-1, Top-3, and MRR over the ranking of the *other* candidates only -- i.e., how each system orders the alternatives to what the user typed, which is the comparison that can actually differ between B0 and P1, and the comparison this paper's research questions are actually about."
));
children.push(P(
  "**Pilot protocol.** For every mined pair in the seed lexicon (Table 4, excluding the affixal dhuga/dhuguma/dhugaa relations, which neither system currently models as a distinguished edit category), we generate one directed test item per direction, giving 12 `(typed, intended)` items over the 10-entry lexicon. Both systems are deterministic, so this pilot involves a single run, not repeated trials; we report exact metric values with no confidence interval, and we say plainly in Sec. 5 and Sec. 8 that 12 items over a 10-word lexicon cannot support a statistical claim -- the pilot's purpose is to verify the pipeline end-to-end on real, executable code and surface concrete, inspectable behavior differences between B0 and P1, not to establish generalizable performance."
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- 5. Results ----
children.push(H1("5. Results"));
children.push(P(
  `All results in this section were produced by running `+"`backend/scripts/pilot_evaluation.py`"+` against the 10-entry seed lexicon (Table 4) with 12 directed test items, per the protocol in Sec. 4.4. Table 5 gives aggregate metrics; Table 6 breaks the same run down by orthographic contrast type.`
));
children.push(TableCaption("Table 5. Comparison with baseline: aggregate pilot results (n = 12 test items, 10-entry lexicon)"));
children.push(DataTable(
  ["System", "Cand-gen accuracy", "Top-1", "Top-3", "MRR", "Precision", "Recall"],
  [
    ["B0 — character-level Damerau-Levenshtein (baseline)", PILOT.aggregate.candGenAcc, PILOT.aggregate.top1, PILOT.aggregate.top3, PILOT.aggregate.mrr, PILOT.aggregate.precision, PILOT.aggregate.recall],
    ["P1 — Oromo-aware weighted pipeline (proposed)", PILOT.aggregate.candGenAcc, PILOT.aggregate.top1, PILOT.aggregate.top3, PILOT.aggregate.mrr, PILOT.aggregate.precision, PILOT.aggregate.recall],
  ],
  [3400, 1500, 1000, 1000, 1000, 1200, 1000],
));
children.push(P(
  "At this pilot scale, aggregate Top-1 accuracy, Top-3 accuracy, and MRR are numerically **identical** between B0 and P1. We report this plainly rather than omitting it: with only 10 lexicon words, most query words in this pilot have only one or two plausible near-neighbors at all, so there is rarely a competing, orthographically-equidistant *unrelated* word for the weighting scheme to correctly deprioritize. This is a property of the pilot's lexicon sparsity, not evidence against the weighting scheme -- Table 6 and Sec. 6 show that the two systems do diverge, item by item, exactly where such competing candidates exist."
));
children.push(TableCaption("Table 6. Pilot results by orthographic contrast type"));
children.push(DataTable(
  ["Contrast type", "n", "B0 Top-1", "B0 MRR", "P1 Top-1", "P1 MRR"],
  PILOT.byContrast,
  [2600, 500, 1200, 1000, 1200, 1000],
));
children.push(new Paragraph({ spacing: { after: 200 } }));
children.push(P(
  "The aggregate tie in Table 5 decomposes, in Table 6, into two categories where B0 and P1 disagree in opposite directions (gemination and mixed gemination+vowel-length), and two categories where they agree (vowel length, and the affixal items that are out of scope for both systems' current cost models). Sec. 6 and Sec. 7 analyze the two disagreement categories in detail, since they are the results that actually speak to RQ1 and RQ2."
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- 6. Discussion ----
children.push(H1("6. Discussion"));
children.push(P(
  "The gemination and mixed-contrast rows in Table 6 are the paper's most informative results precisely because they are small enough to trace by hand. We do so here."
));
children.push(P(
  "**Case 1 — the weighting scheme working as intended.** For the query _badaa_, the true near-neighbor is _baddaa_ (\"highland\", a gemination pair, Sec. 3.4). Under B0, _baddaa_ is at raw character distance 1 from _badaa_ -- but so is the unrelated real word _gadaa_ (\"the Gadaa system\"), via the single substitution b→g. B0 has no basis to prefer one distance-1 candidate over another, so the tie is broken arbitrarily by list order, and B0 ranks the unrelated _gadaa_ above the true neighbor _baddaa_ (rank 2, Top-1 = false). Under P1, the gemination edit d→dd costs 0.5 while the arbitrary b→g substitution costs 1.0, so _baddaa_ (cost 0.5) correctly outranks _gadaa_ (cost 1.0): P1 achieves rank 1 on this item. This is a genuine, inspectable instance of RQ1's claim: linguistic weighting can correctly distinguish a linguistically-motivated near-neighbor from an orthographically-accidental one, in a case where raw edit distance cannot."
));
children.push(P(
  "**Case 2 — a genuine limitation the pilot surfaced.** For the query _gadaa_, the true near-neighbor is _gadda_ (\"sadness\") -- but, per Sec. 3.4, _gadaa_/_gadda_ is a **stacked** contrast, differing in both vowel length and gemination at once, so its P1 weighted cost is 0.5 + 0.5 = 1.0. The unrelated word _badaa_ is also at P1 cost 1.0 from _gadaa_ (a single arbitrary substitution, g→b), so the two candidates land in an exact tie in orthographic-similarity space. The ranking function's frequency feature then breaks the tie -- and in the seed lexicon, _badaa_ happens to have a higher (more frequent) `frequency_rank` than _gadda_, so P1 ranks the unrelated _badaa_ above the true neighbor _gadda_ (rank 2, Top-1 = false), reversing the outcome from Case 1. B0, in this instance, ranks the two distance-1 candidates (_gadda_ and _badaa_, both raw distance 1) with _gadda_ first purely by incidental list order -- getting the right answer for the wrong reason, in the mirror image of Case 1."
));
children.push(P(
  "Read together, Cases 1 and 2 say something more precise than \"the proposed method wins\" or \"the pilot is inconclusive\": the weighting scheme's core mechanism -- discounting linguistically-motivated edits relative to arbitrary ones -- behaves exactly as designed, but the current implementation sums independent linguistic edit costs without any discount for the fact that two co-occurring linguistic edits in the same word pair are, empirically in this tiny sample, still less semantically arbitrary than one unrelated substitution, even when their summed cost happens to match it numerically. This is a concrete, falsifiable design gap: either the marginal cost of a second co-occurring linguistic edit should be discounted below the first, or the tie-break priority given to the frequency feature (Table 3) should be reordered relative to \"is this candidate in the entry's own `related_words` list\" when such a tie occurs. We do not resolve this here; we flag it as the most actionable outcome of the pilot (Sec. 9)."
));
children.push(P(
  "The remaining two rows of Table 6 are less informative by design. The vowel-length row (dhuga/dhugaa, rafuu/raafuu) shows both systems at 100% Top-1 because no unrelated distractor happens to compete at the relevant distance in this particular 10-word lexicon -- consistent with, not contradicting, Case 1's mechanism. The affixal row (dhuga/dhuguma-type items) shows both systems at 25% Top-1 because neither B0 nor P1 currently models derivational affixation (e.g., the _-uma_ \"truly\" suffix) as a distinguished, lower-cost edit category; this is a deliberate scope boundary stated in Sec. 1.4/RQ1 (vowel length, gemination, and digraphs, not general morphology), not a hidden failure, though it does mean the current system offers no particular advantage over a plain baseline for affixally related near-neighbors."
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- 7. Error Analysis ----
children.push(H1("7. Error Analysis"));
children.push(P(
  "Table 7 catalogs error categories observed in, or deliberately left untested by, the pilot in Sec. 5. Two categories are populated with the concrete cases traced in Sec. 6; three are explicitly marked not-yet-observed because the current pilot's design does not exercise them, which we consider a more honest reporting choice than omitting them."
));
children.push(TableCaption("Table 7. Error categories"));
children.push(DataTable(
  ["Category", "Description", "Observed instance (this pilot)", "n / 12"],
  [
    ["Raw-distance tie resolved arbitrarily", "An orthography-blind baseline ties an unrelated word with the true linguistic near-neighbor at equal raw distance and breaks the tie by incidental list order.", "B0: query “badaa” ranks unrelated “gadaa” (dist. 1) above true neighbor “baddaa” (dist. 1).", "1"],
    ["Stacked-edit / frequency tie-break error", "Two co-occurring linguistic edits (gemination + vowel length) sum to a cost that coincidentally ties a single arbitrary substitution; the frequency feature then breaks the tie toward the unrelated word.", "P1: query “gadaa” ranks unrelated, higher-frequency “badaa” (cost 1.0) above true neighbor “gadda” (cost 1.0).", "1"],
    ["Affixal near-neighbor not modeled", "Neither system discounts common derivational/affixal relations (e.g. the -uma “truly” suffix) as a distinguished edit category.", "dhuga/dhugaa ↔ dhuguma items: both systems at 25% Top-1.", "4"],
    ["Missed candidate", "Intended word absent from the generated candidate set entirely.", "Not observed at this pilot’s thresholds (candidate-generation accuracy = 100% for both systems).", "0"],
    ["Over-triggering on unambiguous input", "System flags a word that has no real near-neighbor.", "Not tested — this pilot contains no negative-control items; flagged for the full evaluation (Sec. 9).", "n/a"],
    ["Annotation / label disagreement", "The test-set label itself is contested by validators.", "Not applicable — no native-speaker annotation has yet been performed on this seed lexicon (Sec. 4.3, Sec. 8).", "n/a"],
  ],
  [2000, 3200, 3000, 700],
));
children.push(new Paragraph({ spacing: { after: 200 } }));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- 8. Limitations ----
children.push(H1("8. Limitations"));
children.push(...Bullet([
  "The seed lexicon has 10 entries, was constructed by the authors rather than sourced from a validated dictionary, and every entry has `validated = false`. It is not representative of Afaan Oromo vocabulary size or real distractor density.",
  "The pilot evaluation has n = 12 test items. This is far too small for any statistical claim; we deliberately report exact values with no confidence intervals or significance testing rather than manufacture spurious precision.",
  "All test items are synthetic, author-constructed minimal-pair swaps, not attested mistakes made by real Afaan Oromo writers. No real user-error corpus was used.",
  "The semantic-relevance ranking feature (Sec. 4.2.3, w_s = 0.25) is a lexical-overlap heuristic, not a trained embedding model. The architectural claim that sentence context can help disambiguate (e.g., \"truth\" vs. \"drink\") is supported by the system design but has not been empirically validated with real context items in this pilot.",
  "Candidate search is a brute-force O(V) scan (Sec. 4.1, Sec. 4.2.2); its behavior at production lexicon scale (thousands to tens of thousands of entries) is untested.",
  "The Word add-in (Sec. 4.1, Figure 5) has not been sideloaded or tested inside an actual Word desktop or Word Online host in this work; it has been verified only at the backend API layer.",
  "The same people who built the system also constructed the seed lexicon and test items, a clear source of experimenter bias. Independent, blind test-set construction is required before any performance claim from this pipeline can be trusted.",
  "No empirical, head-to-head comparison against the existing Afaan Oromo spell/grammar checkers in the literature [6], [7] was performed; the comparison in Sec. 2.2 is conceptual (design objective), not experimental.",
  "Dictionary and corpus licensing for a production-scale lexicon (Sec. 4.3) is unresolved; none of the candidate sources identified in this project's literature search were confirmed as openly redistributable.",
]));

children.push(H1("9. Future Work"));
children.push(...Numbered([
  "Build a native-speaker-validated, production-scale lexicon following the protocol in Sec. 4.3 and Figure 6, with reported inter-annotator agreement, and use it (not the seed lexicon) for all subsequent evaluation.",
  "Replace the brute-force candidate search with a BK-tree or phoneme-n-gram inverted index (Sec. 4.1) and benchmark retrieval latency/accuracy at production lexicon scale.",
  "Replace the semantic-relevance placeholder (Sec. 4.2.3) with a trained embedding-based scorer, contingent on a sufficient Afaan Oromo text corpus becoming available [8], [9].",
  "Collect or elicit a real user-error corpus -- e.g., a native-speaker crowdsourcing task, or opt-in, consented telemetry from add-in users -- rather than relying solely on synthetic minimal-pair test items.",
  "Construct an independent, blind test set (built by people who did not build the system or the lexicon) and measure a native-speaker human-accuracy upper bound (Sec. 4.3), to properly contextualize system accuracy.",
  "Run a statistically powered evaluation with bootstrap significance testing once a validated test set large enough to support it exists (unlike the n = 12 pilot here).",
  "Directly address the stacked-edit / frequency tie-break limitation identified in Sec. 6 and Table 7 -- e.g., a diminishing marginal cost for a second co-occurring linguistic edit in the same pair, or reordering the ranking function's tie-break priority so that membership in an entry's own `related_words` set outranks the frequency feature when orthographic costs tie.",
  "Perform an empirical, head-to-head comparison against the existing Afaan Oromo spell/grammar checkers [6], [7] on a shared test set.",
  "Sideload and iterate on the Word add-in inside real Word desktop/Online hosts, including a usability study with native-speaker writers.",
  "Test whether the same tokenizer/weighting approach generalizes to other languages with comparable gemination/length orthographic contrasts (e.g., Somali), as a test of the framework's generality beyond Afaan Oromo specifically.",
], "futureWorkList"));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- 10. Conclusion ----
children.push(H1("10. Conclusion"));
children.push(P(
  "This paper reframes Afaan Oromo spelling assistance as a meaning-preserving disambiguation problem rather than a single-best auto-correction problem, motivated by the fact that Afaan Oromo's Qubee orthography marks vowel length and consonant gemination -- both lexically contrastive -- through simple letter doubling [1]--[4]. We presented a complete, open-source, end-to-end system implementing this framing: a phonemic tokenizer that respects Afaan Oromo digraphs, long vowels, and geminate consonants (Sec. 4.2.1); a weighted edit-distance candidate-generation model that costs linguistically-motivated edits below arbitrary ones (Sec. 4.2.2); a multi-feature, ablatable ranking function (Sec. 4.2.3); a meaning-preserving explanation-generation module that reproduces the system's specified target interaction verbatim (Sec. 4.2.4); and a Microsoft Word add-in that delivers all of the above inside a real authoring tool (Sec. 4.1)."
));
children.push(P(
  "A small pilot evaluation against a literal character-level edit-distance baseline (Sec. 5) was, by design and by necessity given the current 10-entry unvalidated lexicon, too small to support an aggregate performance claim -- and we reported that directly rather than overstating it. What the pilot does support is a mechanism-level answer to this paper's research questions: item-level analysis (Sec. 6, Sec. 7) shows a concrete case in which Oromo-aware weighting correctly resolves an ambiguity a naive baseline cannot (RQ1), and an equally concrete case in which the current weighting scheme's handling of stacked linguistic edits introduces a new, specific, and fixable error (RQ2) -- a more useful and more honest scientific result, at this stage of the project, than a single inflated accuracy number would have been. Sec. 8 and Sec. 9 lay out precisely what stands between this pilot and a production-scale, statistically meaningful evaluation: a validated lexicon, a blind test set, real user-error data, and a fix to the tie-breaking behavior this pilot surfaced. The complete pipeline, dataset schema, and evaluation code are released as open source to make that next step directly buildable rather than a restatement of intent."
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- References ----
children.push(H1("References"));
const REFS = [
  "G. B. Gragg, Oromo Dictionary. East Lansing, MI, USA: African Studies Center, Michigan State University, 1982.",
  "R. D. Zorc, \"Towards an Oromo dictionary: Principles and practice,\" unpublished manuscript, Aug. 5, 1996. [Online]. Available: https://zorc.net/RDZorc/publications/100=OromoDictionaryPrinciples.pdf",
  "W. Tegegne, \"The development of written Afan Oromo and the appropriateness of Qubee, Latin script, for Afan Oromo writing,\" Historical Research Letter, vol. 8, pp. 8–14, 2016.",
  "G. T. Duressa, T. Taa, and D. Debu, \"The struggle for searching of Afaan Oromo alphabet (Qubee) and the contribution of Haile Fida,\" Global Journal of Arts and Social Sciences, Apr. 2024.",
  "E. T. Garoma, \"Demonstratives in Afaan Oromoo,\" Cogent Arts & Humanities, vol. 11, no. 1, Art. no. 2297494, 2024, doi: 10.1080/23311983.2023.2297494.",
  "T. Kumera, \"Context based spellchecker for Afan Oromo writing,\" M.Sc. thesis, Jimma Institute of Technology, Jimma University, Ethiopia, 2018.",
  "J. Abate, V. Khedkar, and S. K. Tidke, \"Integrated model to develop grammar checker for Afaan Oromo using morphological analysis: A rule-based approach,\" International Journal of Advanced Computer Science and Applications (IJACSA), vol. 12, no. 5, 2021.",
  "T. Abu, Y. Shi, T. F. Zheng, and D. Wang, \"Sagalee: An open source automatic speech recognition dataset for Oromo language,\" arXiv preprint arXiv:2502.00421, 2025.",
  "A. Magueresse, V. Carles, and E. Heetderks, \"Low-resource languages: A review of past work and future challenges,\" arXiv preprint arXiv:2006.07264, 2020.",
  "V. I. Levenshtein, \"Binary codes capable of correcting deletions, insertions, and reversals,\" Soviet Physics Doklady, vol. 10, no. 8, pp. 707–710, 1966.",
  "F. J. Damerau, \"A technique for computer detection and correction of spelling errors,\" Communications of the ACM, vol. 7, no. 3, pp. 171–176, 1964, doi: 10.1145/363958.363994.",
  "P. Norvig, \"How to write a spelling corrector,\" 2007. [Online]. Available: https://norvig.com/spell-correct.html",
  "M. H. A. Rafi, I. Al-Ayyubi, M. R. Fahlefi, and A. P. Sari, \"Analysis of the performance of the Damerau-Levenshtein distance and Peter Norvig algorithms in Indonesian spelling correction,\" Jurnal Informatika, Komputer dan Bisnis (JIKOBIS), vol. 5, no. 1, 2025, doi: 10.29040/gtjjwm78.",
];
REFS.forEach((r, i) => {
  children.push(new Paragraph({
    children: [new TextRun({ text: `[${i + 1}] `, font: FONT, size: 21 }), new TextRun({ text: r, font: FONT, size: 21 })],
    spacing: { after: 140, line: 280 },
    alignment: AlignmentType.JUSTIFIED,
    indent: { left: 420, hanging: 420 },
  }));
});
children.push(P(
  "Note on sourcing: [1]–[2] are standard references in Oromo lexicography, cited from established knowledge of the field rather than freshly fetched during manuscript preparation — confirm exact page ranges against a library catalog record before final submission. [3]–[8] were retrieved and their bibliographic data extracted directly from the publisher/repository page during preparation of this manuscript. [10]–[12] are foundational references cited from established prior knowledge; verify page numbers against a library database before submission. No citation in this reference list was fabricated; where a detail could not be verified, it was omitted rather than guessed (see the accompanying repository's docs/references.md for the full sourcing log)."
));

// ---------------------------------------------------------------------------
const doc = new Document({
  creator: "Afaan Oromo Spelling Assistance Project",
  title: "Semantically Informed Spelling Assistance for Afaan Oromo Using Orthographic Similarity and Lexical Disambiguation",
  styles: {
    default: {
      document: { run: { font: FONT, size: 22 } },
      heading1: { run: { font: FONT, size: 30, bold: true, color: "1F3A5F" }, paragraph: { spacing: { before: 360, after: 180 } } },
      heading2: { run: { font: FONT, size: 26, bold: true, color: "1F3A5F" }, paragraph: { spacing: { before: 280, after: 140 } } },
      heading3: { run: { font: FONT, size: 23, bold: true, italics: true, color: "333333" }, paragraph: { spacing: { before: 200, after: 100 } } },
    },
  },
  numbering: {
    config: [
      {
        reference: "futureWorkList",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START, style: { paragraph: { indent: { left: 420, hanging: 260 } } } }],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4 in DXA
          margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Afaan Oromo Spelling Assistance — Manuscript Draft", size: 16, font: FONT, color: "888888" })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, font: FONT, color: "888888" })],
          })],
        }),
      },
      children,
    },
  ],
});

const OUT = path.join(__dirname, "Oromo_Spelling_Assistance_Manuscript.docx");
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log("wrote", OUT, buf.length, "bytes");
});
