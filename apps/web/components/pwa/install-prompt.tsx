"use client";

import React, { useEffect, useState } from "react";
import styles from "./install-prompt.module.css";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    readonly outcome: "accepted" | "dismissed";
    readonly platform: string;
  }>;
  prompt: () => Promise<void>;
}

function isNavigatorWithStandalone(
  navigatorValue: Navigator,
): navigatorValue is Navigator & { readonly standalone?: boolean } {
  return "standalone" in navigatorValue;
}

function isIosSafari() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const isAppleMobile = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  return isAppleMobile && isSafari;
}

function isStandaloneDisplay() {
  if (typeof window === "undefined") {
    return false;
  }

  const mediaStandalone = window.matchMedia("(display-mode: standalone)")
    .matches;
  const navigatorStandalone =
    isNavigatorWithStandalone(navigator) && navigator.standalone === true;
  return mediaStandalone || navigatorStandalone;
}

export function InstallPrompt() {
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setIos(isIosSafari());
    setInstalled(isStandaloneDisplay());

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    }

    function handleInstalled() {
      setInstalled(true);
      setPromptEvent(null);
      setShowIosHelp(false);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (installed || (!promptEvent && !ios)) {
    return null;
  }

  async function install() {
    if (promptEvent) {
      await promptEvent.prompt();
      await promptEvent.userChoice;
      setPromptEvent(null);
      return;
    }
    setShowIosHelp((value) => !value);
  }

  return (
    <div className={styles.installPrompt}>
      <button className={styles.installButton} type="button" onClick={install}>
        설치
      </button>
      {showIosHelp ? (
        <div className={styles.iosHelp} role="status">
          Safari 공유 메뉴에서 홈 화면에 추가를 선택하세요.
        </div>
      ) : null}
    </div>
  );
}
