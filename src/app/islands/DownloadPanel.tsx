import { useEffect, useState } from "preact/hooks";
import { detectPlatform, PLATFORMS, type Platform } from "../../data/platforms";
import styles from "./DownloadPanel.module.css";
import { InstallTerminal } from "./InstallTerminal";

export function DownloadPanel() {
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [saved, setSaved] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy");

  const select = (next: Platform) => {
    setPlatform(next);
    setSaved(false);
    setCopyLabel("Copy");
  };

  useEffect(() => setPlatform(detectPlatform()), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(platform.command);
      setCopyLabel("Copied");
    } catch {
      setCopyLabel("Press Ctrl C");
    }
  };

  return (
    <div class={styles.panel}>
      <div>
        <div class={styles.download}>
          <span class={styles.hook} aria-hidden="true" data-thread-end />
          <a
            class={styles.button}
            href={platform.href}
            download={platform.file}
            data-saved={saved || undefined}
            onClick={() => setSaved(true)}
          >
            Download for {platform.os}
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path d="M12 3v13M6 11l6 6 6-6M4 21h16" />
            </svg>
          </a>
        </div>
        <p class={styles.note} role="status">
          {saved
            ? `Saved as ${platform.file}. Check your downloads.`
            : `Version 1.4.0, for ${platform.requires}.`}
        </p>
        <div class={styles.platforms} role="group" aria-label="Choose a platform">
          {PLATFORMS.map((candidate) => (
            <button
              key={candidate.os}
              type="button"
              aria-pressed={candidate === platform}
              onClick={() => select(candidate)}
            >
              {candidate.os}
            </button>
          ))}
        </div>
        <p class={styles.line}>
          <code>{platform.command}</code>
          <button type="button" onClick={copy}>
            {copyLabel}
          </button>
        </p>
      </div>
      <InstallTerminal key={platform.os} platform={platform} />
    </div>
  );
}
