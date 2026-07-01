"use client";

import { useEffect, useRef } from "react";
import {
  usePersonaClipRecorder,
  type PersonaClipResult,
} from "./use-persona-clip-recorder";
import type { AuthedFetch } from "../../lib/auth-provider";

export type PersonaClipRecorderProps = {
  onComplete: (result: PersonaClipResult) => void;
  onSkip: () => void;
  authedFetch?: AuthedFetch;
};

const buttonStyle = {
  minHeight: 40,
  padding: "0 16px",
  border: "1px solid var(--line-strong)",
  borderRadius: 10,
  background: "var(--surface)",
  color: "var(--ink)",
  font: "inherit",
  cursor: "pointer",
} as const;

const primaryButtonStyle = {
  ...buttonStyle,
  borderColor: "var(--ink)",
  background: "var(--ink)",
  color: "var(--surface)",
} as const;

export function PersonaClipRecorder({
  onComplete,
  onSkip,
  authedFetch,
}: PersonaClipRecorderProps) {
  const {
    status,
    stream,
    errorMessage,
    start,
    stop,
    skip,
  } = usePersonaClipRecorder({
    onComplete,
    onSkip,
    ...(authedFetch ? { authedFetch } : {}),
  });
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.srcObject = stream;
    if (stream) {
      void video.play().catch(() => undefined);
    }

    return () => {
      if (video.srcObject === stream) {
        video.srcObject = null;
      }
    };
  }, [stream]);

  return (
    <section
      aria-labelledby="persona-clip-title"
      style={{
        display: "grid",
        gap: 16,
        width: "100%",
        maxWidth: 560,
        color: "var(--ink)",
      }}
    >
      <div>
        <h2
          id="persona-clip-title"
          style={{ margin: 0, fontSize: 20, lineHeight: 1.3 }}
        >
          Persona Clip
        </h2>
        <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
          선택 사항
        </p>
      </div>

      {status === "recording" ? (
        <div style={{ display: "grid", gap: 12 }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            aria-label="Persona Clip 실시간 카메라 화면"
            style={{
              display: "block",
              width: "100%",
              aspectRatio: "4 / 3",
              borderRadius: 8,
              background: "var(--ink)",
              objectFit: "cover",
            }}
          />
          <button type="button" onClick={stop} style={primaryButtonStyle}>
            녹화 중지
          </button>
        </div>
      ) : null}

      {status === "idle" ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            onClick={() => void start()}
            style={primaryButtonStyle}
          >
            녹화하기
          </button>
          <button type="button" onClick={skip} style={buttonStyle}>
            건너뛰기
          </button>
        </div>
      ) : null}

      {status === "requesting" ? (
        <div style={{ display: "grid", gap: 12 }}>
          <p role="status" style={{ margin: 0, color: "var(--muted)" }}>
            카메라 권한을 확인하는 중입니다.
          </p>
          <div>
            <button type="button" onClick={skip} style={buttonStyle}>
              건너뛰기
            </button>
          </div>
        </div>
      ) : null}

      {status === "uploading" ? (
        <div aria-busy="true" role="status" style={{ display: "grid", gap: 8 }}>
          <p style={{ margin: 0 }}>Persona Clip을 준비하는 중입니다.</p>
          <progress aria-label="Persona Clip 업로드 중" />
        </div>
      ) : null}

      {status === "done" ? (
        <p role="status" style={{ margin: 0, color: "var(--success)" }}>
          Persona Clip이 준비되었습니다.
        </p>
      ) : null}

      {status === "unavailable" ? (
        <div style={{ display: "grid", gap: 12 }}>
          <p role="status" style={{ margin: 0 }}>
            녹화를 사용할 수 없습니다. Persona Clip 없이 계속 진행할 수 있습니다.
          </p>
          <div>
            <button type="button" onClick={skip} style={primaryButtonStyle}>
              계속하기
            </button>
          </div>
        </div>
      ) : null}

      {status === "error" ? (
        <div style={{ display: "grid", gap: 12 }}>
          <p role="alert" style={{ margin: 0, color: "var(--danger)" }}>
            {errorMessage}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              onClick={() => void start()}
              style={primaryButtonStyle}
            >
              다시 시도
            </button>
            <button type="button" onClick={skip} style={buttonStyle}>
              건너뛰기
            </button>
          </div>
        </div>
      ) : null}

      {status === "skipped" ? (
        <p role="status" style={{ margin: 0, color: "var(--muted)" }}>
          Persona Clip 없이 계속합니다.
        </p>
      ) : null}
    </section>
  );
}
