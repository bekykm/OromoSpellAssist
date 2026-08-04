"""Generates all publication figures for the manuscript as PNGs.

Run: python3 make_figures.py
Requires matplotlib (installed in backend/.venv).
"""

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
from matplotlib.path import Path as MplPath
import os

OUT = os.path.dirname(os.path.abspath(__file__))

NAVY = "#1f3a5f"
BLUE = "#4472c4"
LIGHT_BLUE = "#dce6f5"
GREEN = "#2e7d32"
LIGHT_GREEN = "#e2f0e0"
AMBER = "#b8860b"
LIGHT_AMBER = "#faf1de"
GRAY = "#555555"
LIGHT_GRAY = "#eeeeee"
WHITE = "#ffffff"


def box(ax, xy, w, h, text, fc=LIGHT_BLUE, ec=BLUE, fontsize=10.5, weight="normal", textcolor="#1a1a1a"):
    x, y = xy
    patch = FancyBboxPatch(
        (x, y), w, h,
        boxstyle="round,pad=0.02,rounding_size=0.08",
        linewidth=1.4, edgecolor=ec, facecolor=fc, zorder=2,
    )
    ax.add_patch(patch)
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center",
             fontsize=fontsize, color=textcolor, weight=weight, zorder=3, wrap=True)
    return (x, y, w, h)


def arrow(ax, start_box, end_box, side_start="auto", side_end="auto", label=None, color=GRAY, style="-|>", connectionstyle=None, lw=1.3):
    sx, sy, sw, sh = start_box
    ex, ey, ew, eh = end_box
    scx, scy = sx + sw / 2, sy + sh / 2
    ecx, ecy = ex + ew / 2, ey + eh / 2

    if connectionstyle is None:
        if abs(scx - ecx) > abs(scy - ecy):
            p0 = (sx + sw, scy) if ecx > scx else (sx, scy)
            p1 = (ex, ecy) if ecx > scx else (ex + ew, ecy)
        else:
            p0 = (scx, sy) if ecy < scy else (scx, sy + sh)
            p1 = (ecx, ey + eh) if ecy < scy else (ecx, ey)
        connectionstyle = "arc3,rad=0.0"
    else:
        p0, p1 = (scx, scy), (ecx, ecy)

    fa = FancyArrowPatch(p0, p1, arrowstyle=style, mutation_scale=14,
                          linewidth=lw, color=color, zorder=1, connectionstyle=connectionstyle)
    ax.add_patch(fa)
    if label:
        mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
        ax.text(mx, my + 0.06, label, ha="center", va="bottom", fontsize=8.3, color=color, style="italic")


def new_fig(w=10, h=7):
    fig, ax = plt.subplots(figsize=(w, h))
    ax.set_xlim(0, w)
    ax.set_ylim(0, h)
    ax.axis("off")
    return fig, ax


def save(fig, name):
    path = os.path.join(OUT, name)
    fig.tight_layout()
    fig.savefig(path, dpi=220, facecolor="white")
    plt.close(fig)
    print("wrote", path)


# ---------------------------------------------------------------------------
# Figure 1: Overall system architecture
# ---------------------------------------------------------------------------
def fig1():
    fig, ax = new_fig(14.5, 8.5)
    ax.text(7.25, 8.15, "Figure 1. Overall system architecture", ha="center", fontsize=13, weight="bold")

    word = box(ax, (0.35, 6.5), 2.5, 1.15, "Word document\n(user selection)", fc=LIGHT_GRAY, ec=GRAY, fontsize=9.5)
    taskpane = box(ax, (0.35, 4.6), 2.5, 1.15, "Task pane\n(React, Office.js)", fc=LIGHT_BLUE, ec=BLUE, fontsize=9.5)
    arrow(ax, word, taskpane, label="selected word", color="#666666")

    api = box(ax, (0.35, 2.6), 2.5, 1.15, "FastAPI\nGET /suggest", fc=LIGHT_GREEN, ec=GREEN, fontsize=9.5)
    arrow(ax, taskpane, api, label="HTTPS")

    steps = ["Word\nidentifi-\ncation", "Dictionary\nlookup", "Orthographic\nsimilarity\nsearch",
             "Candidate\nranking", "Meaning\nretrieval", "Explanation\ngeneration"]
    boxes = []
    x0 = 3.7
    w = 1.5
    gap = 0.2
    y_pipe = 5.5
    for i, s in enumerate(steps):
        x = x0 + i * (w + gap)
        b = box(ax, (x, y_pipe), w, 1.5, s, fc=WHITE, ec=NAVY, fontsize=8.3)
        boxes.append(b)
    for i in range(len(boxes) - 1):
        arrow(ax, boxes[i], boxes[i + 1], color=NAVY, lw=1.1)
    arrow(ax, api, boxes[0], color=NAVY)

    db = box(ax, (5.6, 2.9), 3.4, 1.15, "Lexical database (SQLite / Postgres)\nused by lookup, search, ranking, retrieval", fc=LIGHT_AMBER, ec=AMBER, fontsize=8.2)
    arrow(ax, boxes[3], db, color=AMBER, lw=1.1, connectionstyle="arc3,rad=-0.2")

    resp = box(ax, (10.1, 2.9), 3.4, 1.15, "SuggestResponse\n(message, suggestions, explanations)", fc=LIGHT_GREEN, ec=GREEN, fontsize=8.6)
    arrow(ax, boxes[5], resp, color=NAVY, connectionstyle="arc3,rad=0.25")
    arrow(ax, resp, taskpane, label="JSON", color=GREEN)

    save(fig, "fig1_overall_architecture.png")


# ---------------------------------------------------------------------------
# Figure 2: Candidate generation workflow
# ---------------------------------------------------------------------------
def fig2():
    fig, ax = new_fig(9, 8.5)
    b1 = box(ax, (3.2, 7.6), 2.6, 0.7, "Input word w")
    b2 = box(ax, (3.2, 6.5), 2.6, 0.7, "tokenize(w)\n(phonology.py)")
    b3 = box(ax, (3.0, 5.3), 3.0, 0.8, "For each vocabulary\nword l in lexicon")
    b4 = box(ax, (3.2, 4.1), 2.6, 0.7, "tokenize(l)")
    b5 = box(ax, (3.0, 2.9), 3.0, 0.8, "weighted token\nedit distance(w, l)")
    b6 = box(ax, (3.0, 1.7), 3.0, 0.8, "cost ≤ max_cost?", fc=LIGHT_AMBER, ec=AMBER)
    b7 = box(ax, (0.3, 0.4), 2.6, 0.7, "discard", fc=LIGHT_GRAY, ec=GRAY)
    b8 = box(ax, (5.9, 0.4), 2.8, 0.7, "add to candidate set\n(with edit trace)", fc=LIGHT_GREEN, ec=GREEN)

    for a, b in [(b1, b2), (b2, b3), (b3, b4), (b4, b5), (b5, b6)]:
        arrow(ax, a, b)
    arrow(ax, b6, b7, label="no", connectionstyle="arc3,rad=-0.2")
    arrow(ax, b6, b8, label="yes", connectionstyle="arc3,rad=0.2")

    loop_arrow = FancyArrowPatch((3.0, 5.7), (2.0, 5.7), connectionstyle="arc3,rad=1.4",
                                  arrowstyle="-|>", mutation_scale=13, linewidth=1.1, color=GRAY)
    ax.add_patch(loop_arrow)
    ax.text(1.3, 6.9, "next l", fontsize=8.5, color=GRAY, style="italic")

    ax.text(4.5, 8.25, "Figure 2. Candidate generation workflow", ha="center", fontsize=12, weight="bold")
    save(fig, "fig2_candidate_generation_workflow.png")


# ---------------------------------------------------------------------------
# Figure 3: Orthographic similarity model
# ---------------------------------------------------------------------------
def fig3():
    fig, ax = new_fig(10, 6.5)
    src = box(ax, (0.4, 4.8), 2.2, 1.1, "dhuga", fc=LIGHT_BLUE, ec=BLUE, fontsize=14, weight="bold")
    tgt = box(ax, (0.4, 3.2), 2.2, 1.1, "dhugaa", fc=LIGHT_BLUE, ec=BLUE, fontsize=14, weight="bold")

    toks_src = ["dh", "u", "g", "a"]
    toks_tgt = ["dh", "u", "g", "aa"]
    tx = 3.4
    for i, (a, b) in enumerate(zip(toks_src, toks_tgt)):
        y = 5.7 - i * 1.05
        box(ax, (tx, y), 1.1, 0.7, a, fc=WHITE, ec=NAVY, fontsize=11)
        box(ax, (tx + 2.0, y), 1.1, 0.7, b, fc=WHITE, ec=NAVY, fontsize=11)
        same = a == b
        color = "#bbbbbb" if same else AMBER
        fa = FancyArrowPatch((tx + 1.1, y + 0.35), (tx + 2.0, y + 0.35), arrowstyle="-", mutation_scale=10, linewidth=1.6, color=color)
        ax.add_patch(fa)
        label = "match (0.0)" if same else "vowel_length (0.5)"
        ax.text(tx + 1.55, y + 0.5, label, ha="center", fontsize=8, color=color)

    ax.text(3.95, 6.35, "src tokens", ha="center", fontsize=9, color=GRAY)
    ax.text(5.95, 6.35, "tgt tokens", ha="center", fontsize=9, color=GRAY)

    cost_box = box(ax, (6.9, 4.55), 2.6, 1.0, "Total weighted cost\n= 0.5", fc=LIGHT_GREEN, ec=GREEN, fontsize=10.5)
    ax.annotate("", xy=(6.9, 5.05), xytext=(6.3, 5.05),
                arrowprops=dict(arrowstyle="-|>", color=GREEN, lw=1.3))

    legend_y = 1.9
    legend = [
        ("match", "#bbbbbb", "0.0"),
        ("vowel_length / gemination", AMBER, "0.5"),
        ("digraph confusion", "#8e44ad", "0.7"),
        ("arbitrary sub / ins / del", "#c0392b", "1.0"),
    ]
    ax.text(0.4, legend_y + 0.55, "Substitution cost by edit type:", fontsize=10, weight="bold")
    for i, (lab, col, cost) in enumerate(legend):
        y = legend_y - i * 0.42
        ax.add_patch(plt.Rectangle((0.4, y), 0.3, 0.22, color=col))
        ax.text(0.85, y + 0.11, f"{lab}  (cost {cost})", fontsize=9.3, va="center")

    ax.text(5, 6.15 + 0.05, "", fontsize=1)
    ax.text(5.0, 6.65, "Figure 3. Orthographic similarity model: token-level weighted comparison, dhuga vs dhugaa", ha="center", fontsize=11.5, weight="bold")
    save(fig, "fig3_orthographic_similarity_model.png")


# ---------------------------------------------------------------------------
# Figure 4: Lexical disambiguation pipeline
# ---------------------------------------------------------------------------
def fig4():
    fig, ax = new_fig(10, 6.5)
    b1 = box(ax, (0.4, 4.9), 2.6, 1.0, "Ranked candidates\n(ranking.py)", fc=LIGHT_BLUE, ec=BLUE)
    b2 = box(ax, (3.6, 4.9), 2.8, 1.0, "build_suggestions\n(top-k selection)")
    b3 = box(ax, (7.0, 4.9), 2.4, 1.0, "explain_difference\n(dominant edit op)")
    arrow(ax, b1, b2)
    arrow(ax, b2, b3)

    b4 = box(ax, (3.6, 2.9), 2.8, 1.0, "render_message\n'Did you mean X (m1)\\nor Y (m2)?'", fontsize=9, fc=LIGHT_GREEN, ec=GREEN)
    b5 = box(ax, (7.0, 2.9), 2.4, 1.0, "render_explanations\n(per-candidate detail)", fontsize=9.3, fc=LIGHT_GREEN, ec=GREEN)
    arrow(ax, b3, b4, connectionstyle="arc3,rad=-0.25")
    arrow(ax, b3, b5)

    b6 = box(ax, (5.0, 1.0), 3.0, 1.0, "SuggestResponse\n(JSON)", fc=LIGHT_AMBER, ec=AMBER)
    arrow(ax, b4, b6, connectionstyle="arc3,rad=0.2")
    arrow(ax, b5, b6, connectionstyle="arc3,rad=-0.2")

    ax.text(5.0, 6.1, "Figure 4. Lexical disambiguation pipeline", ha="center", fontsize=12, weight="bold")
    save(fig, "fig4_disambiguation_pipeline.png")


# ---------------------------------------------------------------------------
# Figure 5: Word plugin architecture
# ---------------------------------------------------------------------------
def fig5():
    fig, ax = new_fig(10, 7.5)
    manifest = box(ax, (0.4, 5.9), 2.6, 1.0, "manifest.xml\n(ribbon registration)", fc=LIGHT_GRAY, ec=GRAY, fontsize=9.5)
    ribbon = box(ax, (3.6, 5.9), 2.6, 1.0, "Ribbon button:\nOromo Assistant", fc=LIGHT_GRAY, ec=GRAY, fontsize=9.5)
    tphtml = box(ax, (6.8, 5.9), 2.6, 1.0, "taskpane.html", fc=LIGHT_GRAY, ec=GRAY, fontsize=9.5)
    arrow(ax, manifest, ribbon)
    arrow(ax, ribbon, tphtml)

    tsx = box(ax, (6.8, 4.3), 2.6, 1.0, "Taskpane.tsx\n(React component)", fc=LIGHT_BLUE, ec=BLUE, fontsize=9.5)
    arrow(ax, tphtml, tsx)

    off = box(ax, (4.3, 2.7), 2.4, 1.0, "office.ts\n(Word.run, read selection)", fc=LIGHT_BLUE, ec=BLUE, fontsize=9)
    api = box(ax, (7.1, 2.7), 2.4, 1.0, "api.ts\n(fetch /suggest)", fc=LIGHT_BLUE, ec=BLUE, fontsize=9)
    arrow(ax, tsx, off, connectionstyle="arc3,rad=0.15")
    arrow(ax, tsx, api, connectionstyle="arc3,rad=-0.15")

    doc = box(ax, (4.3, 1.0), 2.4, 1.0, "Active Word document", fc=LIGHT_GRAY, ec=GRAY, fontsize=9)
    backend = box(ax, (7.1, 1.0), 2.4, 1.0, "FastAPI backend\n(HTTPS)", fc=LIGHT_GREEN, ec=GREEN, fontsize=9)
    arrow(ax, off, doc, label="Word.run", lw=1.1)
    arrow(ax, api, backend, label="HTTPS", lw=1.1)

    ax.text(5.0, 7.1, "Figure 5. Microsoft Word plugin architecture", ha="center", fontsize=12, weight="bold")
    save(fig, "fig5_plugin_architecture.png")


# ---------------------------------------------------------------------------
# Figure 6: Dataset and annotation workflow
# ---------------------------------------------------------------------------
def fig6():
    fig, ax = new_fig(10, 6.8)
    steps = [
        ("Source acquisition\n(dictionaries, corpora,\nweb-crawled text)", LIGHT_AMBER, AMBER),
        ("Automated minimal-pair\nmining (tokenizer +\nweighted edit distance)", LIGHT_BLUE, BLUE),
        ("Double annotation\n(2 native-speaker\nannotators per pair)", LIGHT_BLUE, BLUE),
        ("Adjudication\n(3rd annotator resolves\ndisagreement)", LIGHT_BLUE, BLUE),
        ("Held-out validation\n(disjoint speaker panel,\ncorrect + swapped controls)", LIGHT_GREEN, GREEN),
        ("validated=true\nlexicon entry", LIGHT_GREEN, GREEN),
    ]
    boxes = []
    for i, (label, fc, ec) in enumerate(steps):
        x = 0.4 + i * 1.55
        b = box(ax, (x, 3.2), 1.4, 1.7, label, fc=fc, ec=ec, fontsize=7.6)
        boxes.append(b)
    for i in range(len(boxes) - 1):
        arrow(ax, boxes[i], boxes[i + 1], lw=1.1)

    iaa = box(ax, (2.0, 1.0), 3.0, 1.0, "Inter-annotator agreement\n(Cohen's κ) recorded", fc=WHITE, ec=NAVY, fontsize=9)
    arrow(ax, boxes[3], iaa, connectionstyle="arc3,rad=0.3", color=NAVY)

    ax.text(5.0, 5.6, "Figure 6. Dataset construction and annotation workflow", ha="center", fontsize=12, weight="bold")
    save(fig, "fig6_dataset_annotation_workflow.png")


# ---------------------------------------------------------------------------
# Figure 7: Ranking mechanism
# ---------------------------------------------------------------------------
def fig7():
    fig, ax = new_fig(9.5, 6.8)
    feats = [
        ("Orthographic\nsimilarity", "w_o = 0.45", LIGHT_BLUE, BLUE),
        ("Frequency\nscore", "w_f = 0.20", LIGHT_AMBER, AMBER),
        ("Lexical\nvalidity", "w_v = 0.10", LIGHT_GRAY, GRAY),
        ("Semantic\nrelevance", "w_s = 0.25", LIGHT_GREEN, GREEN),
    ]
    boxes = []
    for i, (label, w, fc, ec) in enumerate(feats):
        y = 4.9 - i * 1.15
        b = box(ax, (0.4, y), 2.6, 0.95, f"{label}\n({w})", fc=fc, ec=ec, fontsize=9.3)
        boxes.append(b)

    sumbox = box(ax, (5.0, 2.6), 2.2, 1.4, "Σ weighted\nsum", fc=WHITE, ec=NAVY, fontsize=11, weight="bold")
    for b in boxes:
        arrow(ax, b, sumbox, lw=1.0, connectionstyle="arc3,rad=0.08")

    scorebox = box(ax, (7.7, 2.85), 1.7, 0.9, "final\nscore", fc=LIGHT_GREEN, ec=GREEN, fontsize=10)
    arrow(ax, sumbox, scorebox)

    ax.text(4.75, 6.05, "Figure 7. Candidate ranking mechanism (Table 4)", ha="center", fontsize=12, weight="bold")
    save(fig, "fig7_ranking_mechanism.png")


if __name__ == "__main__":
    fig1(); fig2(); fig3(); fig4(); fig5(); fig6(); fig7()
