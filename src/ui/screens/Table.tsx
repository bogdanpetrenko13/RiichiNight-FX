import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ActionName, CallKind, TileCode } from "../../engine/protocol";
import { CUTAWAY_MS, type GameController } from "../../game/useGameController";
import { useApp } from "../../app/AppContext";
import type { StringKey } from "../../i18n/strings";
import { bandVars, useLayout } from "../useLayout";
import { sameType } from "../tiles";
import { rememberClaim, rememberHandDiscard } from "../motion";
import { PlayerHand } from "../components/PlayerHand";
import { ActionBar } from "../components/ActionBar";
import { RoundResult } from "../components/RoundResult";
import { GameOver } from "../components/GameOver";
import { CallCutaway } from "../components/CallCutaway";
import { ErrorDialog } from "../components/ErrorDialog";
import { testCrash } from "../components/ScreenErrorBoundary";
import { RivalBand } from "../components/RivalBand";
import { PlayerBand } from "../components/PlayerBand";
import { TableCenter } from "../components/TableCenter";
import { WaitsChip } from "../components/WaitsChip";
import { IconButton, Sheet } from "../components/Primitives";
import { Icon } from "../icons";
import { lookAttrs } from "../tableLook";
import { usePeek } from "../usePeek";
import { QuickSettings } from "../components/QuickSettings";
import type { ScoreFx } from "../components/BandScore";
import { flyCopies, fxMs } from "../tableFx";
import { sfx } from "../../game/sfx";
import { RoundSplash } from "../components/RoundSplash";
import styles from "./Table.module.css";

interface TableProps {
  game: GameController;
  onTitle: () => void;
  onAgain: () => void;
  /** Open another screen; the match stays loaded and resumes on return. */
  onOpen: (screen: "learn" | "settings") => void;
}

/** The deal that already played its animation (survives leaving the table). */
let dealtKey = "";
/** The deal whose round splash already played (not again on re-opening the table). */
let splashedKey = "";

export function Table({ game, onTitle, onAgain, onOpen }: TableProps) {
  testCrash("table");
  const { t, settings } = useApp();
  const layout = useLayout();
  const { view, cast, emotions, callouts, freshMeld, speech, cutaway, busy, error } = game;

  // Stable handle for timers: the controller object changes identity every render.
  const gameRef = useRef(game);
  gameRef.current = game;

  const [selected, setSelected] = useState<number | null>(null);
  const [riichiMode, setRiichiMode] = useState(false);
  const [chiPicker, setChiPicker] = useState(false);
  /** Chi with several options: index of the first hand tile picked. */
  const [chiFirst, setChiFirst] = useState<number | null>(null);
  const [ackRound, setAckRound] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const peek = usePeek();
  // Turning the phone: the table is rebuilt for the new shape out of sight
  // (bands and hand hidden, no slides), then fades in already settled,
  // instead of tiles and bands visibly squeezing into place.
  const [reflow, setReflow] = useState(false);
  const shownOrientation = useRef(layout.orientation);
  useLayoutEffect(() => {
    if (shownOrientation.current === layout.orientation) return;
    shownOrientation.current = layout.orientation;
    setReflow(true);
    let raf = 0;
    const timer = window.setTimeout(() => {
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => setReflow(false));
      });
    }, 140);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [layout.orientation]);
  // Rivals wait while the menu is open.
  useEffect(() => {
    gameRef.current.setPaused(menuOpen);
  }, [menuOpen]);

  // Rivers are sized from the real size of the bands area.
  const bandsRef = useRef<HTMLDivElement>(null);
  const [bandsBox, setBandsBox] = useState({ w: 0, h: 0, gap: 6 });
  useEffect(() => {
    const el = bandsRef.current;
    if (!el) return;
    // The gap between bands depends on the table style (--band-gap).
    const update = () =>
      setBandsBox({ w: el.clientWidth, h: el.clientHeight, gap: parseFloat(getComputedStyle(el).rowGap) || 0 });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view !== null]);
  const bandStyle = useMemo(
    () => bandVars(layout.orientation, bandsBox.w, bandsBox.h, layout.left, bandsBox.gap),
    [layout.orientation, layout.left, bandsBox.w, bandsBox.h, bandsBox.gap],
  );

  // Any new engine state clears local selection modes.
  const promptKey = view ? `${view.round.index}:${view.players[0].discards.length}:${view.status}:${view.players[0].handCount}` : "";
  useEffect(() => {
    setSelected(null);
    setRiichiMode(false);
    setChiPicker(false);
    setChiFirst(null);
  }, [promptKey]);

  // Tiles fly in for a moment after each new deal: once per deal (not again
  // when the table is re-opened from the tutorial or settings), and set
  // before the first paint so the finished hand never flashes first.
  const roundIndex = view?.round.index ?? 0;
  const dealKey = view ? `${view.seed}:${roundIndex}` : "";
  const freshDeal = Boolean(view && view.players[0].discards.length === 0 && view.players.every((p) => p.discards.length === 0));
  const [dealing, setDealing] = useState(false);
  useLayoutEffect(() => {
    if (!settings.dealAnimation || !roundIndex || !dealKey || dealtKey === dealKey) return;
    dealtKey = dealKey;
    if (!freshDeal) return;
    setDealing(true);
    const timer = window.setTimeout(() => setDealing(false), 1100);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealKey, settings.dealAnimation]);

  // A splash names the round and the dealer as each hand starts.
  // The first hand of a match also rolls the dice for the first East: a
  // longer splash, the dice land with the dice sound (~0.9 s).
  const firstHand = roundIndex === 1;
  const splashMs = fxMs(firstHand ? 2400 : 1500);
  const rollMs = firstHand ? fxMs(900) : 0;
  const [splash, setSplash] = useState<string | null>(null);
  useLayoutEffect(() => {
    if (!splashMs || !roundIndex || !dealKey || splashedKey === dealKey) return;
    splashedKey = dealKey;
    if (!freshDeal || view?.result) return;
    setSplash(dealKey);
    const timer = window.setTimeout(() => setSplash(null), splashMs);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealKey, splashMs]);

  // In riichi the only legal move is discarding the drawn tile: do it for the player.
  const onlyDiscard =
    view?.status === "human" &&
    view.players[0].riichi &&
    view.prompt?.actions.length === 1 &&
    view.prompt.actions[0] === "discard";
  const drawnTile = view?.players[0].drawn ?? null;
  useEffect(() => {
    if (!settings.autoDiscardRiichi || !onlyDiscard || !drawnTile || busy) return;
    const timer = window.setTimeout(() => {
      rememberHandDiscard(drawnTile);
      void gameRef.current.act({ action: "discard", tile: drawnTile });
    }, 550);
    return () => window.clearTimeout(timer);
  }, [settings.autoDiscardRiichi, onlyDiscard, drawnTile, busy, promptKey]);

  // The result panel waits until the Ron/Tsumo banner and the heroine's line
  // have played; a tap anywhere skips the wait.
  // (Not keyed on the status: the last hand of a match goes round_over ->
  // game_over with the same result, and must not wait and show it again.)
  const resultKey = view?.result ? `${view.round.index}:${view.result.type}` : null;
  const [released, setReleased] = useState<string | null>(null);
  // Points change hands on the table first (Settings -> Table animations):
  // after the Ron/Tsumo banner the riichi sticks fly to the winner and every
  // score counts to its new value with the change floating beside it; then
  // the result card.
  const isWin = Boolean(resultKey?.endsWith(":win"));
  const transferDelay = isWin ? CUTAWAY_MS + 100 : 500;
  const transferMs = fxMs(1300);
  const scoreFx = useMemo<(ScoreFx | null)[]>(() => {
    const result = view?.result;
    if (!view || !result || !resultKey || !transferMs) return [null, null, null, null];
    return view.players.map((p) => ({
      key: resultKey,
      from: p.score - (result.deltas[p.seat] ?? 0),
      to: p.score,
      delay: transferDelay,
      duration: transferMs,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultKey, transferMs]);
  const [sticksTaken, setSticksTaken] = useState<string | null>(null);
  useEffect(() => {
    if (!resultKey) return;
    const ms = transferMs ? transferDelay + transferMs + 450 : isWin ? CUTAWAY_MS + 600 : 900;
    const timer = window.setTimeout(() => setReleased(resultKey), ms);
    // The winner sweeps up the riichi sticks: the ones in front of the
    // rivers and those left on the table from earlier hands.
    const result = gameRef.current.view?.result;
    const sticksTimer =
      transferMs && result?.type === "win"
        ? window.setTimeout(() => {
            const first = result.winners[0];
            const earlier = Math.max(0, Math.round((first?.calc?.sticks ?? 0) / 1000) - (result.riichiPaid?.length ?? 0));
            const lines = [...document.querySelectorAll("[data-riichi-stick]:not([data-empty]) > *")];
            const counter = document.querySelector("[data-sticks-counter] > svg");
            const sources = [...lines, ...(counter ? Array.from({ length: Math.min(3, earlier) }, () => counter) : [])];
            if (!sources.length || !first) return;
            flyCopies(sources, document.querySelector(`[data-score-seat="${first.seat}"]`), Math.round(transferMs * 0.6));
            setSticksTaken(resultKey);
            void sfx.play("sticks", Math.round(transferMs * 0.45));
          }, transferDelay)
        : undefined;
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(sticksTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultKey]);
  const holding = resultKey !== null && released !== resultKey;
  const skipHold = () => {
    gameRef.current.skipCutaway();
    if (resultKey) setReleased(resultKey);
  };

  // A rival comments when the player takes a long time.
  const waitingForHuman = view?.status === "human" && !menuOpen;
  useEffect(() => {
    if (!waitingForHuman) return;
    const timer = window.setTimeout(() => gameRef.current.sayIdle(), 25000);
    return () => window.clearTimeout(timer);
  }, [waitingForHuman, promptKey]);

  const calloutBySeat = useMemo(() => {
    const map: Record<number, CallKind> = {};
    for (const c of callouts) map[c.seat] = c.kind;
    return map;
  }, [callouts]);
  // "from Yuzu" / "from you" under a rival's announcement.
  const calloutFrom = (seat: number): string | null => {
    const c = [...callouts].reverse().find((x) => x.seat === seat);
    if (!c || c.from === undefined || c.from === null) return null;
    if (c.from === 0) return t("callFromYou");
    const who = cast[c.from - 1];
    return who ? t("callFrom", { name: who.name[settings.lang].split(" ")[0] }) : null;
  };

  if (!view) return null;
  const prompt = view.status === "human" ? view.prompt : null;
  const me = view.players[0];
  const allTiles = me.drawn ? [...(me.hand ?? []), me.drawn] : me.hand ?? [];
  const selectedTile = selected !== null ? allTiles[selected] ?? null : null;

  const act = (action: ActionName, extra?: { tile?: TileCode; option?: number }) => {
    if (extra?.tile && (action === "discard" || action === "riichi")) rememberHandDiscard(extra.tile);
    // A claimed discard flies from the rival's river into the new meld.
    if (action === "pon" || action === "chi" || action === "kan") rememberClaim(document.querySelector("[class*=river] [class*=highlight]"));
    setSelected(null);
    setRiichiMode(false);
    setChiPicker(false);
    void game.act({ action, ...extra });
  };

  const claimer = prompt?.claim ? cast[prompt.claim.from - 1] : undefined;
  const statusText = error
    ? t("errTitle")
    : view.status === "human"
      ? claimer
        ? t("claimFrom", { name: claimer.name[settings.lang].split(" ")[0] })
        : t("yourTurn")
      : view.status === "ai"
        ? t("waitingFor")
        : null;

  const portrait = layout.orientation === "portrait";
  const actionBar = (
    <ActionBar
      prompt={prompt}
      riichiMode={riichiMode}
      chiPicker={chiPicker}
      busy={busy}
      selectedTile={selectedTile}
      onDiscardSelected={() => selectedTile && act(riichiMode ? "riichi" : "discard", { tile: selectedTile })}
      onAction={(action, option) => act(action, option !== undefined ? { option } : undefined)}
      onRiichiMode={(on) => {
        setSelected(null);
        setRiichiMode(on);
      }}
      onChiPicker={setChiPicker}
      row={portrait}
      strip={!portrait && chiPicker}
    />
  );
  const waitsChip = (
    <WaitsChip player={me} prompt={prompt} selectedCode={selectedTile} riichiMode={riichiMode} />
  );

  const showRound =
    !holding &&
    view.result !== null &&
    (view.status === "round_over" || (view.status === "game_over" && ackRound !== view.round.index));
  const showGameOver = view.status === "game_over" && !showRound && !holding;

  return (
    <div
      className={styles.table}
      data-orientation={layout.orientation}
      data-style={settings.tableStyle}
      data-peek={peek.kind ?? undefined}
      data-reflow={reflow || undefined}
      data-sticks-taken={(resultKey !== null && sticksTaken === resultKey) || undefined}
      {...lookAttrs(settings)}
      {...peek.handlers}
      style={layout.vars}
    >
      {/* Long press on a tile: its visible copies stay lit, the rest of the table dims. */}
      {peek.kind && (
        <style>{`[data-peek="${peek.kind}"] [data-kind="${peek.kind}"][data-kind] { filter: none; outline: 3px solid var(--pointer); outline-offset: 1px; z-index: var(--z-local); }`}</style>
      )}
      <header className={styles.topBar} data-zone>
        <IconButton icon="menu" label={t("menu")} onClick={() => setMenuOpen(true)} />
        <div className={styles.roundInfo}>
          <b>{t("roundLabel", { wind: t(`wind_${view.round.wind}` as StringKey), n: view.round.number })}</b>
          {statusText && <span key={statusText}>{statusText}</span>}
        </div>
        <IconButton icon="help" label={t("yakuRef")} onClick={() => onOpen("learn")} />
      </header>

      {/* Kemono-style bands: kamicha, toimen, shimocha, then the player.
          Rows in portrait, columns in landscape. */}
      <div className={styles.bands} ref={bandsRef} style={bandStyle} data-zone>
        {[3, 2, 1].map((seat) => {
          const character = cast[seat - 1];
          if (!character) return null;
          return (
            <RivalBand
              key={seat}
              character={character}
              player={view.players[seat]}
              emotion={emotions[seat]}
              callout={calloutBySeat[seat] ?? null}
              calloutFrom={calloutBySeat[seat] ? calloutFrom(seat) : null}
              freshMeld={freshMeld === seat}
              speech={speech[seat]?.text ?? null}
              active={view.current === seat && view.status === "ai"}
              dealer={view.round.dealer === seat}
              claimed={prompt?.claim?.from === seat ? prompt.claim.tile : null}
              riverCols={layout.orientation === "portrait" ? 9 : 6}
              tsumogiri={game.tsumogiri[seat]}
              scoreFx={scoreFx[seat]}
            />
          );
        })}
        {portrait && <TableCenter view={view} />}
        {splash === dealKey && <RoundSplash view={view} cast={cast} ms={splashMs} rollMs={rollMs} />}
        <PlayerBand
          view={view}
          active={view.current === 0 && view.status === "human"}
          waits={waitsChip}
          callout={calloutBySeat[0] ?? null}
          calloutFrom={calloutBySeat[0] ? calloutFrom(0) : null}
          riverCols={portrait ? 9 : 6}
          scoreFx={scoreFx[0]}
        />
      </div>


      {/* The hand across the bottom; in landscape the buttons sit to its right. */}
      <div className={styles.dock} data-zone>
        <PlayerHand
          player={me}
          prompt={prompt}
          riichiMode={riichiMode}
          selected={selected}
          onSelect={setSelected}
          onDiscard={(tile) => act("discard", { tile })}
          onRiichi={(tile) => act("riichi", { tile })}
          dealing={dealing}
          dealId={dealKey}
          chiMode={chiPicker ? { first: chiFirst } : null}
          freshMeld={freshMeld === 0}
          onChiTile={(i) => {
            const options = prompt?.chiOptions ?? [];
            const code = allTiles[i];
            if (chiFirst === i) {
              setChiFirst(null);
              return;
            }
            const first = chiFirst !== null ? allTiles[chiFirst] : null;
            const matches = options
              .map((o, k) => ({ o, k }))
              .filter(({ o }) => o.some((c) => sameType(c, code)) && (!first || o.some((c) => sameType(c, first))));
            if (matches.length === 1) act("chi", { option: matches[0].k });
            else if (matches.length > 1) setChiFirst(i);
          }}
        />
        {/* Portrait: a reserved row under the hand; landscape: a column of
            fixed height to its right. Either way the hand and the bands keep
            their size when buttons appear (the waits live in the player band). */}
        <div className={portrait ? styles.actionsRow : styles.actions} data-actions>
          {portrait || !chiPicker ? actionBar : null}
        </div>
        {/* Landscape Chi chooser: a strip over the hand (the button column is
            too narrow for three sequences at a readable size). */}
        {!portrait && chiPicker ? <div className={styles.chiStrip}>{actionBar}</div> : null}
      </div>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={t("menu")}>
        <div className={styles.menuList}>
          <button className="btn btn-primary btn-lg" onClick={() => setMenuOpen(false)}>
            <Icon name="play" />
            {t("resume")}
          </button>
          <QuickSettings />
          <button className="btn btn-lg" onClick={() => onOpen("learn")}>
            <Icon name="book" />
            {t("learn")}
          </button>
          <button className="btn btn-lg" onClick={() => onOpen("settings")}>
            <Icon name="settings" />
            {t("settings")}
          </button>
          <button className="btn btn-ghost btn-lg" onClick={onTitle}>
            <Icon name="home" />
            {t("toTitle")}
          </button>
          <p className={styles.menuNote}>{t("savedNote")}</p>
        </div>
      </Sheet>

      {error && <ErrorDialog error={error} onRetry={() => void game.retry()} onRecover={game.recover} onTitle={onTitle} />}

      {cutaway && (
        <CallCutaway
          key={cutaway.id}
          cutaway={cutaway}
          cast={cast}
          onSkip={holding ? skipHold : game.skipCutaway}
          passThrough={Boolean(view?.prompt?.actions.some((a) => a !== "discard"))}
        />
      )}
      {holding && !cutaway && <button className={styles.skipLayer} onClick={skipHold} aria-label={t("continue")} />}

      {showRound && (
        <RoundResult
          view={view}
          cast={cast}
          busy={busy}
          onNext={() => {
            // Seen: if this hand ends the match, the next view (game_over,
            // same hand) goes straight to the final standings.
            setAckRound(view.round.index);
            if (view.status !== "game_over") void game.nextRound();
          }}
        />
      )}

      {showGameOver && (
        <GameOver
          view={view}
          cast={cast}
          onAgain={onAgain}
          onTitle={onTitle}
          finale={game.finale}
        />
      )}

    </div>
  );
}
