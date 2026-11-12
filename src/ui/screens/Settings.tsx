import { useApp } from "../../app/AppContext";
import { LANGS, type StringKey } from "../../i18n/strings";
import type { GameRules } from "../../engine/protocol";
import {
  FELT_COLORS,
  FELT_SWATCH,
  RING_SWATCH,
  STYLE_TILESET,
  TABLE_FX,
  TABLE_STYLES,
  THEME_MODES,
  TILESETS,
  TILE_BACKS,
  TILE_BACK_SWATCH,
  TURN_RINGS,
  TURN_RING_STYLES,
  type Settings,
} from "../../game/storage";
import { lookAttrs } from "../tableLook";
import { TileRow } from "../components/TileRow";
import { Tile } from "../components/Tile";
import { AppBar, Group, Row, Segmented, Switch } from "../components/Primitives";
import { SpeedSlider } from "../components/QuickSettings";
import { haptics, vibrationSupported } from "../../game/haptics";
import { VibrationCheck } from "../components/VibrationCheck";
import styles from "./SettingsScreen.module.css";

/** The app is AGPL: whoever gets it can get the source (see NOTICE.md). */
const SOURCE_URL = "https://github.com/bogdanpetrenko13/RiichiNight-FX";
const GAME_TOGGLES: (keyof Omit<GameRules, "gameLength">)[] = ["redFives", "openTanyao", "tobi", "agariYame", "kiriageMangan"];


type BoolKey = { [K in keyof Settings]-?: Settings[K] extends boolean ? K : never }[keyof Settings];

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { t, settings, updateSettings } = useApp();

  const toggle = (key: BoolKey, label: StringKey, hint?: StringKey) => (
    <Row label={t(label)} hint={hint ? t(hint) : undefined}>
      <Switch
        label={t(label)}
        checked={settings[key]}
        onChange={(v) => {
          updateSettings({ [key]: v });
          // Switching vibration on buzzes once, so you feel that it works.
          if (key === "haptics" && v) haptics.test();
        }}
      />
    </Row>
  );
  const setRules = (patch: Partial<GameRules>) => updateSettings({ gameRules: { ...settings.gameRules, ...patch } });

  const slider = (key: "voiceVolume" | "sfxVolume" | "musicVolume", label: StringKey) => (
    <Row label={t(label)}>
      <input
        className={styles.slider}
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={settings[key]}
        onChange={(e) => updateSettings({ [key]: Number(e.target.value) })}
        aria-label={t(label)}
      />
    </Row>
  );

  return (
    <div className="screen">
      <AppBar title={t("settings")} onBack={onBack} />
      <div className="screen-body">
        <Group>
          <Row label={t("language")} stacked>
            <Segmented
              value={settings.lang}
              options={LANGS.map((l) => ({ value: l, label: l === "ru" ? "Русский" : "English" }))}
              onChange={(lang) => updateSettings({ lang })}
            />
          </Row>
        </Group>

        <Group title={t("appearance")}>
          <Row label={t("tableStyle")} hint={t(`tableStyle_${settings.tableStyle}_hint` as StringKey)} stacked>
            <Segmented
              value={settings.tableStyle}
              options={TABLE_STYLES.map((st) => ({ value: st, label: t(`tableStyle_${st}` as StringKey) }))}
              onChange={(tableStyle) => updateSettings({ tableStyle, tileset: STYLE_TILESET[tableStyle] })}
            />
          </Row>
          {settings.tableStyle === "felt" && (
            <Row label={t("feltColor")} hint={t(`feltColor_${settings.feltColor}` as StringKey)} stacked>
              <Swatches
                value={settings.feltColor}
                options={FELT_COLORS.map((c) => ({ value: c, label: t(`feltColor_${c}` as StringKey), color: FELT_SWATCH[c] }))}
                onChange={(feltColor) => updateSettings({ feltColor })}
              />
            </Row>
          )}
          <Row label={t("turnRing")} hint={t(`turnRing_${settings.turnRing}` as StringKey)} stacked>
            <div className={styles.ringControls}>
              <Swatches
                value={settings.turnRing}
                options={TURN_RINGS.map((r) => ({
                  value: r,
                  label: t(`turnRing_${r}` as StringKey),
                  color: r === "auto" ? undefined : RING_SWATCH[r],
                }))}
                onChange={(turnRing) => updateSettings({ turnRing })}
              />
              <div className={styles.ringStyle}>
                <Segmented
                  value={settings.turnRingStyle}
                  options={TURN_RING_STYLES.map((m) => ({ value: m, label: t(`turnRingStyle_${m}` as StringKey) }))}
                  onChange={(turnRingStyle) => updateSettings({ turnRingStyle })}
                />
              </div>
            </div>
          </Row>
          <Row label={t("dealerChip")} hint={t(`turnRing_${settings.dealerChip}` as StringKey)} stacked>
            <div className={styles.ringControls}>
              <Swatches
                value={settings.dealerChip}
                options={TURN_RINGS.map((r) => ({
                  value: r,
                  label: t(`turnRing_${r}` as StringKey),
                  color: r === "auto" ? undefined : RING_SWATCH[r],
                }))}
                onChange={(dealerChip) => updateSettings({ dealerChip })}
              />
              <LookPreview settings={settings} />
            </div>
          </Row>
          <Row label={t("tileset")} stacked>
            <Segmented
              value={settings.tileset}
              options={TILESETS.map((ts) => ({ value: ts, label: t(`tileset_${ts}` as StringKey) }))}
              onChange={(tileset) => updateSettings({ tileset })}
            />
            <div className={styles.preview}>
              <TileRow text="19m 5p 9s 1234z 67z" size={28} hints />
            </div>
          </Row>
          <Row
            label={t("tileBack")}
            hint={t(settings.tileBack === "auto" ? "tileBack_auto" : (`feltColor_${settings.tileBack}` as StringKey))}
            stacked
          >
            <Swatches
              value={settings.tileBack}
              options={TILE_BACKS.map((c) => ({
                value: c,
                label: t(c === "auto" ? "tileBack_auto" : (`feltColor_${c}` as StringKey)),
                color: c === "auto" ? undefined : TILE_BACK_SWATCH[c],
              }))}
              onChange={(tileBack) => updateSettings({ tileBack })}
            />
            <div className={styles.backs} aria-hidden>
              {Array.from({ length: 6 }, (_, i) => (
                <Tile key={i} back size="river" />
              ))}
            </div>
          </Row>
          <Row label={t("tileHints")} stacked>
            <Segmented
              value={settings.tileHints}
              options={(["none", "man", "all"] as const).map((m) => ({ value: m, label: t(`tileHints_${m}` as StringKey) }))}
              onChange={(tileHints) => updateSettings({ tileHints })}
            />
          </Row>
          <Row label={t("theme")} stacked>
            <Segmented
              value={settings.theme}
              options={THEME_MODES.map((m) => ({ value: m, label: t(`theme_${m}` as StringKey) }))}
              onChange={(theme) => updateSettings({ theme })}
            />
          </Row>
        </Group>

        <Group title={t("gameplay")}>
          <Row label={t("aiSpeed")} hint={t("aiDelayValue", { s: (settings.aiDelay / 1000).toFixed(1) })} stacked>
            <SpeedSlider />
          </Row>
          {toggle("showWaitHints", "waitHints")}
          {toggle("autoDiscardRiichi", "autoDiscardRiichi")}
          {toggle("markTsumogiri", "markTsumogiri", "markTsumogiriHint")}
          {toggle("safeTiles", "safeTiles", "safeTilesHint")}
          {toggle("dealAnimation", "dealAnimation")}
          {/* Safari on iPhone cannot vibrate: no vibration rows there. */}
          {vibrationSupported() && toggle("haptics", "hapticsSetting")}
          {vibrationSupported() && settings.haptics && <VibrationCheck />}
          <Row label={t("tableFx")} hint={t("tableFxHint")} stacked>
            <Segmented
              value={settings.tableFx}
              options={TABLE_FX.map((v) => ({ value: v, label: t(`tableFx_${v}` as StringKey) }))}
              onChange={(tableFx) => updateSettings({ tableFx })}
            />
          </Row>
          <Row label={t("speechFreq")} stacked>
            <Segmented
              value={settings.speechFreq}
              options={(["often", "normal", "rare", "off"] as const).map((v) => ({ value: v, label: t(`speech_${v}` as StringKey) }))}
              onChange={(speechFreq) => updateSettings({ speechFreq })}
            />
          </Row>
          {slider("voiceVolume", "voiceVolume")}
          {slider("sfxVolume", "sfxVolume")}
          {slider("musicVolume", "musicVolume")}
        </Group>

        <Group title={t("gameRules")}>
          <Row label={t("gameLength")} hint={t("rulesNote")} stacked>
            <Segmented
              value={settings.gameRules.gameLength}
              options={[
                { value: "east", label: t("length_east") },
                { value: "hanchan", label: t("length_hanchan") },
              ]}
              onChange={(gameLength) => setRules({ gameLength })}
            />
          </Row>
          {GAME_TOGGLES.map((key) => (
            <Row key={key} label={t(`rule_${key}` as StringKey)}>
              <Switch
                label={t(`rule_${key}` as StringKey)}
                checked={settings.gameRules[key]}
                onChange={(v) => setRules({ [key]: v })}
              />
            </Row>
          ))}
        </Group>

        <Group title={t("about")}>
          <Row label={t("version")}>
            <span className="muted">{__APP_VERSION__}</span>
          </Row>
          <Row label={t("sourceCode")} hint={t("sourceCodeHint")} stacked>
            <a className={`btn ${styles.link}`} href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
              {t("sourceCodeOpen")}
            </a>
          </Row>
          <Row label={t("credits")} hint={t("creditsMusic")} stacked>
            <span />
          </Row>
          <Row label={t("creditsVoiceTitle")} hint={t("creditsVoice")} stacked>
            <span />
          </Row>
        </Group>
      </div>
    </div>
  );
}

/** Round colour chips; "auto" (no colour) shows a split chip. */
function Swatches<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; color?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className={styles.swatches} role="radiogroup" style={{ ["--n" as string]: options.length }}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          aria-label={o.label}
          title={o.label}
          data-on={o.value === value || undefined}
          data-auto={o.color === undefined || undefined}
          className={styles.swatch}
          style={o.color ? { ["--sw" as string]: o.color } : undefined}
          onClick={() => onChange(o.value)}
        />
      ))}
    </div>
  );
}

/** Two small bands in the chosen look; the upper one has the turn. */
function LookPreview({ settings }: { settings: Settings }) {
  const { t } = useApp();
  return (
    <div className={styles.look} data-style={settings.tableStyle} data-fx={settings.tableFx} {...lookAttrs(settings)} aria-hidden>
      <div className={styles.lookBand} data-zone data-active>
        <span className={styles.lookWind} data-dealer>
          {t("wind_east")}
        </span>
        <TileRow text="345m 77p" size={22} />
      </div>
      <div className={styles.lookBand} data-zone>
        <span className={styles.lookWind}>{t("wind_south")}</span>
        <TileRow text="1z 9s" size={22} />
      </div>
    </div>
  );
}
