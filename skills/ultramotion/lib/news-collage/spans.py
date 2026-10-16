"""Find phrases on a PDF page and print their boxes, to highlight them on a picture of the page.

    python3 spans.py filing.pdf 8 'were CAPE to cease' '$30 billion'
    → {"were CAPE to cease": [[111.0, 72.5, 73.5, 13.3]], "$30 billion": [[372.6, 72.5, 52.7, 13.3]]}

Boxes are [x, y, w, h] in PDF points, one per line the phrase runs over. Render the page with
`pdftoppm -r 150 -f 8 -l 8 -jpeg filing.pdf page` and pass the boxes to the piece as `imageSpans`
with `imageUnit: 150 / 72`. Needs poppler (pdftotext, pdftoppm).
"""
import json, re, subprocess, sys

def spans(pdf, page, phrases):
    s = subprocess.run(['pdftotext', '-f', str(page), '-l', str(page), '-bbox', pdf, '-'], capture_output=True, text=True, check=True).stdout
    W = [(float(a), float(b), float(c), float(d), w) for a, b, c, d, w in re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>', s)]
    out = {}
    for ph in phrases:
        toks = ph.split()
        for i in range(len(W) - len(toks) + 1):
            if [w[4] for w in W[i:i + len(toks)]] == toks:
                lines = {}
                for w in W[i:i + len(toks)]: lines.setdefault(round(w[1]), []).append(w)
                out[ph] = [[round(min(w[0] for w in L), 1), round(min(w[1] for w in L), 1), round(max(w[2] for w in L) - min(w[0] for w in L), 1),
                            round(max(w[3] for w in L) - min(w[1] for w in L), 1)] for L in lines.values()]
                break
        else: print('not found on page %s: %s' % (page, ph), file=sys.stderr)
    return out

if __name__ == '__main__':
    print(json.dumps(spans(sys.argv[1], int(sys.argv[2]), sys.argv[3:])))
