#!/usr/bin/env python3
"""Wkleja Luci do prezentacji HTML, żeby działała bez internetu i była jednym plikiem.

  python3 osmiornica/wklej.py prezentacja.html               wkleja Luci albo aktualizuje ją do bieżącej wersji
  python3 osmiornica/wklej.py prezentacja.html --online      zamiast kodu podpina adres z GitHub Pages
  python3 osmiornica/wklej.py prezentacja.html --usun        usuwa Luci z prezentacji
  python3 osmiornica/wklej.py *.html --aktualizuj            aktualizuje tylko te pliki, w których Luci już jest

Wszystko, co dotyczy Luci, leży w jednym bloku przed </body>, między znacznikami
<!-- Luci: początek ... --> i <!-- Luci: koniec -->. Ustawienia (window.OSMIORNICA = {...})
przechodzą bez zmian przez aktualizację i zmianę wariantu.
"""
import hashlib
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
URL = 'https://lucid-academy.github.io/ai-lab/osmiornica/osmiornica.js'
START = '<!-- Luci: początek ({}). Aktualizacja: osmiornica/wklej.py z repo lucid-academy/ai-lab -->'
END = '<!-- Luci: koniec -->'
BLOCK = re.compile(r'[ \t]*<!-- Luci: początek(.*?)-->.*?<!-- Luci: koniec -->[ \t]*\r?\n?', re.S)
TAG = re.compile(r'[ \t]*<script\b[^>]*\bsrc\s*=\s*["\'][^"\']*osmiornica\.js["\'][^>]*>\s*</script\s*>[ \t]*\r?\n?', re.I)
CONFIG = re.compile(r'[ \t]*<script\b(?![^>]*\bsrc)[^>]*>\s*window\.OSMIORNICA\s*=.*?</script\s*>[ \t]*\r?\n?', re.S | re.I)
DEFAULT_CONFIG = "<script>window.OSMIORNICA = { mode: 'lecture' }</script>"


def engine():
    js = (HERE / 'osmiornica.js').read_text(encoding='utf-8')
    if '<!--' in js:
        sys.exit('osmiornica.js zawiera "<!--", a tego nie da się bezpiecznie wkleić do <script>. Popraw silnik.')
    # a closing script tag inside the code would end the inline script early
    js = re.sub(r'</(script)', r'<\\/\1', js, flags=re.I).strip('\n')
    return js, hashlib.sha1(js.encode('utf-8')).hexdigest()[:8]


def take_out(html):
    """Removes Luci from the page; returns (page, her config line or None, what was there or None)."""
    m = BLOCK.search(html)
    if m:
        cfg = CONFIG.search(m.group(0))
        v = re.search(r'wersja (\w+)', m.group(1))
        was = v.group(1) if v else 'online'
        return html[:m.start()] + html[m.end():], cfg and cfg.group(0).strip(), was
    if TAG.search(html):
        cfg = CONFIG.search(html)
        return CONFIG.sub('', TAG.sub('', html)), cfg and cfg.group(0).strip(), 'online'
    return html, None, None


def put_in(html, block, nl):
    i = html.lower().rfind('</body>')
    if i < 0:
        return html.rstrip() + nl + block + nl
    s = html.rfind('\n', 0, i) + 1
    if html[s:i].strip():  # </body> shares its line with content: give the block lines of its own
        return html[:i] + nl + block + nl + html[i:]
    return html[:s] + block + nl + html[s:]  # right above </body>, which keeps its indentation


def run(path, opts, js, ver):
    if path.resolve().parent == HERE:
        return f'{path.name}: pomijam pliki samej Luci.'
    with open(path, encoding='utf-8', newline='') as f:
        html = f.read()
    nl = '\r\n' if '\r\n' in html else '\n'
    page, cfg, was = take_out(html)
    if '--aktualizuj' in opts and not was:
        return f'{path.name}: pomijam, nie ma tu Luci.'
    if '--usun' in opts:
        if not was:
            return f'{path.name}: nie ma tu Luci.'
        out, msg = page, f'{path.name}: usunięto Luci.'
    else:
        cfg = cfg or DEFAULT_CONFIG
        if '--online' in opts or ('--aktualizuj' in opts and was == 'online'):
            block = nl.join([START.format('online'), cfg, f'<script src="{URL}" defer></script>', END])
            msg = f'{path.name}: Luci podpięta z GitHub Pages (aktualizuje się sama, potrzebny internet).'
        else:
            block = nl.join([START.format('wersja ' + ver), cfg, '<script>', js.replace('\n', nl), '</script>', END])
            kb = round(len(js.encode('utf-8')) / 1024)
            msg = (f'{path.name}: wklejono Luci (wersja {ver}, {kb} KB). Działa bez internetu.' if not was
                   else f'{path.name}: Luci wklejona na stałe zamiast adresu online (wersja {ver}). Działa bez internetu.' if was == 'online'
                   else f'{path.name}: zaktualizowano Luci z wersji {was} do {ver}, ustawienia bez zmian.')
        out = put_in(page, block, nl)
        if out == html:
            msg = f'{path.name}: Luci jest już aktualna, nic do zmiany.'
    if out != html:
        with open(path, 'w', encoding='utf-8', newline='') as f:
            f.write(out)
    return msg


def main(argv):
    files = [pathlib.Path(a) for a in argv if not a.startswith('--')]
    opts = {a for a in argv if a.startswith('--')}
    if not files or opts - {'--online', '--usun', '--aktualizuj'} or {'--online', '--usun'} <= opts:
        print(__doc__.strip())
        return 2
    js, ver = engine()
    for p in files:
        print(run(p, opts, js, ver) if p.is_file() else f'{p}: nie ma takiego pliku.')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
