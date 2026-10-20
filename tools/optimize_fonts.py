"""Create WOFF2 copies without subsetting glyphs. Requires fonttools[woff]."""
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen


def convert(source):
    output = source.with_suffix('.woff2')
    font = TTFont(source)
    font.flavor = 'woff2'
    font.save(output)
    restored = TTFont(output)
    assert font.getBestCmap() == restored.getBestCmap(), source
    assert font['hmtx'].metrics == restored['hmtx'].metrics, source
    original_glyphs, restored_glyphs = font.getGlyphSet(), restored.getGlyphSet()
    for name in font.getGlyphOrder():
        before, after = RecordingPen(), RecordingPen()
        original_glyphs[name].draw(before)
        restored_glyphs[name].draw(after)
        assert before.value == after.value, (source, name)
    print(f'{source.name}: {source.stat().st_size} → {output.stat().st_size} bytes; glyphs and metrics verified')


if __name__ == '__main__':
    folder = Path(__file__).resolve().parents[1] / 'assets/fonts'
    for name in ('anton.ttf', 'spicy-rice.ttf', 'lemon-tuesday.otf', 'knewave.ttf', 'berkshire-swash.ttf'):
        convert(folder / name)
