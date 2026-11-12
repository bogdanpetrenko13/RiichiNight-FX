"""The effects layer (src/ui/fx): one canvas over the table, Canvas 2D, four
presets (sparks, petals, gold, rays). The frame loop runs only while
particles live, the "short" setting spawns fewer of them, "off" (and reduced
motion) spawns nothing and never draws a frame. A win bursts sparks over the
winner's band; `?fx=<preset>` previews another preset on the win."""

import pytest

from conftest import LANDSCAPE, PORTRAIT

PRESETS = ["sparks", "petals", "gold", "rays"]
CANVAS = "canvas[data-fx]"
# Count of pixels with any alpha in the effects canvas.
PAINTED = """() => {
  const c = document.querySelector('canvas[data-fx]');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
  return n;
}"""


def _cut_junk(app):
    app.wait_my_turn()
    if app.page.locator("[class*=dock] button[aria-label='1z']").count():
        app.discard("1z")


def _frames(page):
    return page.evaluate("() => window.__rnFx.frames()")


def _settled(page, timeout=6_000):
    """Waits for the last particle to go and the loop to stop; the canvas is clean."""
    page.wait_for_function("() => !window.__rnFx.active() && window.__rnFx.count() === 0", timeout=timeout)
    frames = _frames(page)
    page.wait_for_timeout(250)
    assert _frames(page) == frames, "frames keep coming with nothing to draw"
    assert page.evaluate(PAINTED) == 0


@pytest.mark.parametrize("fx,vp", [("full", PORTRAIT), ("full", LANDSCAPE), ("off", PORTRAIT)])
def test_a_win_bursts_sparks_over_the_winner(make_app, fx, vp):
    app = make_app(vp).open("?scenario=tsumo&seed=5", {"tableFx": fx}).start_game()
    page = app.page
    # One canvas over the table, inert to taps, hidden from readers.
    assert page.locator(CANVAS).count() == 1
    assert page.evaluate("() => getComputedStyle(document.querySelector('canvas[data-fx]')).pointerEvents") == "none"
    box = page.locator(CANVAS).bounding_box()
    assert box["width"] >= vp["width"] - 2 and box["height"] >= vp["height"] - 2, box
    # Idle: no frame has been drawn.
    assert _frames(page) == 0 and not page.evaluate("() => window.__rnFx.active()")
    _cut_junk(app)
    app.button("Цумо").first.wait_for(timeout=60_000)
    app.button("Цумо").first.click()
    if fx == "off":
        page.locator("button:has-text('Следующая раздача')").wait_for(timeout=30_000)
        assert _frames(page) == 0 and page.evaluate("() => window.__rnFx.count()") == 0
        assert page.evaluate(PAINTED) == 0
        return
    page.wait_for_function("() => window.__rnFx.active() && window.__rnFx.count() > 0", timeout=10_000)
    page.wait_for_timeout(200)
    # The burst starts at the player's band: paint lies over it.
    band = page.locator("[data-score-seat='0']").locator("xpath=ancestor::section[1]").bounding_box()
    centre = page.evaluate(
        """(b) => {
          const c = document.querySelector('canvas[data-fx]'), r = c.getBoundingClientRect(), s = c.width / r.width;
          const d = c.getContext('2d').getImageData((b.x + b.width / 2 - r.left - 60) * s, (b.y + b.height / 2 - r.top - 60) * s, 120 * s, 120 * s).data;
          let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n;
        }""",
        band,
    )
    assert centre > 0, "no sparks near the winner's band"
    assert page.evaluate(PAINTED) > 0
    app.shot(f"fx_win_{vp['width']}x{vp['height']}")
    _settled(page)
    assert not app.errors, app.errors


@pytest.mark.parametrize("preset", PRESETS)
def test_each_preset_flies_then_the_loop_stops(make_app, preset):
    app = make_app(PORTRAIT).open("?seed=7", {"tableFx": "full"}).start_game()
    page = app.page
    n = page.evaluate("(p) => window.__rnFx.play(p)", preset)
    assert n > 0, preset
    assert page.evaluate("() => window.__rnFx.active()")
    page.wait_for_timeout(350)
    assert page.evaluate(PAINTED) > 0, f"{preset} drew nothing"
    f1 = _frames(page)
    page.wait_for_timeout(200)
    assert _frames(page) > f1, "the loop stands still mid-flight"
    app.shot(f"fx_{preset}")
    _settled(page)
    # A second burst restarts the loop from a clean canvas.
    assert page.evaluate("(p) => window.__rnFx.play(p)", preset) > 0
    assert page.evaluate("() => window.__rnFx.active()")
    _settled(page)
    assert not app.errors, app.errors


def test_short_spawns_fewer_and_ends_sooner_than_full(make_app):
    counts, times = {}, {}
    for level in ["full", "short"]:
        app = make_app(PORTRAIT).open("?seed=7", {"tableFx": level}).start_game()
        page = app.page
        counts[level] = page.evaluate("() => window.__rnFx.play('gold')")
        t0 = page.evaluate("() => performance.now()")
        page.wait_for_function("() => !window.__rnFx.active()", timeout=6_000)
        times[level] = page.evaluate("() => performance.now()") - t0
        assert not app.errors, app.errors
    assert 0 < counts["short"] < counts["full"], counts
    assert times["short"] < times["full"] * 0.8, times


def test_reduced_motion_plays_nothing(make_app):
    app = make_app(PORTRAIT)
    app.page.emulate_media(reduced_motion="reduce")
    app.open("?seed=7", {"tableFx": "full"}).start_game()
    page = app.page
    assert page.evaluate("() => window.__rnFx.play('sparks')") == 0
    page.wait_for_timeout(200)
    assert _frames(page) == 0 and not page.evaluate("() => window.__rnFx.active()")
    assert not app.errors, app.errors


def test_a_win_previews_the_preset_from_the_url(make_app):
    app = make_app(PORTRAIT).open("?scenario=tsumo&seed=5&fx=petals", {"tableFx": "full"}).start_game()
    page = app.page
    _cut_junk(app)
    app.button("Цумо").first.wait_for(timeout=60_000)
    app.button("Цумо").first.click()
    page.wait_for_function("() => window.__rnFx.active()", timeout=10_000)
    # Petals come from the top edge of the table, not from the band.
    page.wait_for_timeout(500)
    top = page.evaluate(
        """() => {
          const c = document.querySelector('canvas[data-fx]');
          const d = c.getContext('2d').getImageData(0, 0, c.width, Math.round(c.height * 0.3)).data;
          let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n;
        }"""
    )
    assert top > 0
    app.shot("fx_win_petals")
    _settled(page, timeout=8_000)
    assert not app.errors, app.errors
