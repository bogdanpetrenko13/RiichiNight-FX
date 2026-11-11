import { useState } from "react";
import type { GameError } from "../../game/useGameController";
import { useApp } from "../../app/AppContext";
import styles from "./Overlay.module.css";

/**
 * Engine failure: a plain-language dialog instead of a Python traceback.
 * Try again (repeat the failed action), continue from the last save, or go
 * to the title screen. The technical details can be copied for a report.
 */
export function ErrorDialog({
  error,
  onRetry,
  onRecover,
  onTitle,
}: {
  error: GameError;
  onRetry: () => void;
  onRecover: () => Promise<boolean>;
  onTitle: () => void;
}) {
  const { t } = useApp();
  const [copied, setCopied] = useState(false);
  const [noSave, setNoSave] = useState(false);
  const [open, setOpen] = useState(false);

  const report = [
    `Riichi Night FX ${__APP_VERSION__}`,
    new Date(error.at).toISOString(),
    navigator.userAgent,
    "",
    error.detail,
  ].join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
    } catch {
      setOpen(true); // no clipboard access: show the text so it can be selected
    }
  };

  return (
    <div className={styles.calcLayer} role="alertdialog" aria-modal="true" aria-labelledby="engine-error-title">
      <div className={`panel ${styles.calcDialog}`}>
        <header className={styles.calcDialogHead}>
          <h2 id="engine-error-title">{t("errTitle")}</h2>
        </header>
        <p className={styles.errText}>{t("errText")}</p>
        {noSave && <p className={styles.errText}>{t("errNoSave")}</p>}
        <div className={styles.errButtons}>
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            {t("errRetry")}
          </button>
          <button
            type="button"
            className="btn"
            onClick={async () => {
              if (!(await onRecover())) setNoSave(true);
            }}
          >
            {t("errRecover")}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onTitle}>
            {t("toTitle")}
          </button>
        </div>
        <div className={styles.errMeta}>
          <button type="button" className={styles.calcToggle} onClick={() => setOpen(!open)}>
            {t("errDetails")} <span aria-hidden>{open ? "▴" : "▾"}</span>
          </button>
          <button type="button" className={styles.calcToggle} onClick={copy}>
            {copied ? t("errCopied") : t("errCopy")}
          </button>
        </div>
        {open && <pre className={styles.errDetail}>{report}</pre>}
      </div>
    </div>
  );
}
