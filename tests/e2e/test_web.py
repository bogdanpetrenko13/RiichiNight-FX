"""The web version (GitHub Pages, for iPhones): offline play through the
service worker (scripts/web/sw.js), the install manifest, and a browser that
cannot vibrate (Safari on iPhone).

The app never registers its worker under test automation (navigator.webdriver,
so Playwright routes keep working); these tests register it themselves.
"""

import json
import os

from conftest import DIST, PORTRAIT


def _register(page):
    page.evaluate(
        """async () => {
             await navigator.serviceWorker.register('./sw.js');
             const reg = await navigator.serviceWorker.ready;
             if (!navigator.serviceWorker.controller)
               await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
             return reg.active.state;
           }"""
    )


def test_service_worker_lists_every_built_file():
    sw = open(os.path.join(DIST, "sw.js"), encoding="utf8").read()
    assert "__FILES__" not in sw and "__VERSION__" not in sw
    files = json.loads(sw.split("const FILES = ", 1)[1].split(";\n", 1)[0])
    for needed in ["./index.html", "./pyodide/pyodide.asm.wasm", "./py/bridge.py", "./manifest.webmanifest"]:
        assert needed in files, needed
    assert any(f.startswith("./mortal/") and f.endswith(".wasm") for f in files)
    missing = [f for f in files if f != "./" and not os.path.exists(os.path.join(DIST, f[2:]))]
    assert not missing, missing[:5]


def test_manifest_makes_it_installable(make_app):
    app = make_app(PORTRAIT).open()
    page = app.page
    href = page.locator("link[rel=manifest]").get_attribute("href")
    manifest = page.evaluate("(h) => fetch(h).then((r) => r.json())", href)
    assert manifest["display"] == "standalone"
    assert {i["sizes"] for i in manifest["icons"]} >= {"192x192", "512x512"}
    assert page.locator("meta[name=apple-mobile-web-app-capable]").get_attribute("content") == "yes"
    assert not app.errors, app.errors


def test_plays_offline_after_the_first_visit(make_app):
    """After one visit the whole game is cached: with the network gone the
    page reloads, the engine (Pyodide) boots and a hand is dealt."""
    app = make_app(PORTRAIT).open()
    page = app.page
    _register(page)
    cached = page.evaluate(
        """async () => {
             const keys = await caches.keys();
             const c = await caches.open(keys.find((k) => k.startsWith('riichinightfx-')));
             const names = ['./mortal/s42.f16.bin', './pyodide/python_stdlib.zip', './py/bridge.py'];
             return Promise.all(names.map(async (n) => Boolean(await c.match(n))));
           }"""
    )
    assert all(cached), cached
    page.context.set_offline(True)
    try:
        page.reload()
        page.get_by_text("Новая игра").first.wait_for(timeout=60_000)
        app.start_game()  # waits for the dealt hand
    finally:
        page.context.set_offline(False)
    assert not app.errors, app.errors


def test_no_vibration_settings_where_the_phone_cannot_vibrate(make_app):
    """Safari on iPhone has no navigator.vibrate: the vibration switch and
    check are hidden instead of doing nothing."""
    app = make_app(PORTRAIT)
    app.page.add_init_script("delete Navigator.prototype.vibrate")
    app.open("", {"haptics": True})
    page = app.page
    page.get_by_text("Настройки", exact=True).first.click()
    page.get_by_role("switch", name="Показывать ожидания при сбросе").first.wait_for(timeout=10_000)
    assert page.get_by_role("switch", name="Вибрация").count() == 0
    assert page.locator("[data-vibration-check]").count() == 0
    assert not app.errors, app.errors
