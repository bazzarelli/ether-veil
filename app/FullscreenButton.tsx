"use client";

import { useCallback, useEffect, useState } from "react";

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function getFullscreenElement(doc: FullscreenDocument) {
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export default function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const doc = document as FullscreenDocument;

    const syncFullscreenState = () => {
      setIsFullscreen(Boolean(getFullscreenElement(doc)));
    };

    syncFullscreenState();
    doc.addEventListener("fullscreenchange", syncFullscreenState);
    doc.addEventListener("webkitfullscreenchange", syncFullscreenState as EventListener);

    return () => {
      doc.removeEventListener("fullscreenchange", syncFullscreenState);
      doc.removeEventListener("webkitfullscreenchange", syncFullscreenState as EventListener);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const doc = document as FullscreenDocument;
    const root = document.documentElement as FullscreenElement;

    try {
      if (getFullscreenElement(doc)) {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
          return;
        }

        if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }

        return;
      }

      if (root.requestFullscreen) {
        await root.requestFullscreen();
        return;
      }

      if (root.webkitRequestFullscreen) {
        await root.webkitRequestFullscreen();
      }
    } catch {
      // Ignore permission/gesture errors and keep UI responsive.
    }
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        void toggleFullscreen();
      }}
      className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-cyan-200/40 text-cyan-200/70 transition hover:border-cyan-200/70 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70"
      aria-label={isFullscreen ? "Exit fullscreen presentation mode" : "Enter fullscreen presentation mode"}
      title={isFullscreen ? "Exit fullscreen" : "Present fullscreen"}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M8 3H3v5" />
        <path d="M3 3l6 6" />
        <path d="M16 3h5v5" />
        <path d="M21 3l-6 6" />
        <path d="M8 21H3v-5" />
        <path d="M3 21l6-6" />
        <path d="M16 21h5v-5" />
        <path d="M21 21l-6-6" />
      </svg>
    </button>
  );
}
