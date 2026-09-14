"use client";

import { useEffect, useRef, useState } from "react";
import type { BodyShow, Card } from "@/lib/types";

export type DriveRequest =
  | { twist: { x: number; y: number; yaw: number } }
  | { do: string }
  | { halt: true };

const WALK_X = 0.2;
const WALK_YAW = 0.8;

const MOVE_KEYS = new Set([
  "w",
  "a",
  "s",
  "d",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
]);

function typingIn(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

function twistFromKeys(down: Set<string>): { x: number; y: number; yaw: number } {
  const x =
    (down.has("w") || down.has("arrowup") ? WALK_X : 0) +
    (down.has("s") || down.has("arrowdown") ? -WALK_X : 0);
  const yaw =
    (down.has("a") || down.has("arrowleft") ? WALK_YAW : 0) +
    (down.has("d") || down.has("arrowright") ? -WALK_YAW : 0);
  return { x, y: 0, yaw };
}

function HoldButton({
  label,
  disabled,
  onHold,
  onRelease,
}: {
  label: string;
  disabled: boolean;
  onHold: () => void;
  onRelease: () => void;
}) {
  const hold = useRef<{ timer: number; stop: () => void } | null>(null);
  const onHoldRef = useRef(onHold);
  const onReleaseRef = useRef(onRelease);
  onHoldRef.current = onHold;
  onReleaseRef.current = onRelease;

  useEffect(() => {
    return () => {
      hold.current?.stop();
    };
  }, []);

  return (
    <button
      type="button"
      className="drive-btn"
      disabled={disabled}
      onPointerDown={(ev) => {
        if (disabled) return;
        ev.preventDefault();
        hold.current?.stop();
        const fire = () => onHoldRef.current();
        const timer = window.setInterval(fire, 200);
        const stop = () => {
          window.clearInterval(timer);
          window.removeEventListener("pointerup", stop);
          window.removeEventListener("pointercancel", stop);
          hold.current = null;
          onReleaseRef.current();
        };
        hold.current = { timer, stop };
        window.addEventListener("pointerup", stop);
        window.addEventListener("pointercancel", stop);
        fire();
      }}
    >
      {label}
    </button>
  );
}

export default function DrivePad({
  body,
  send,
}: {
  body: BodyShow;
  send: (cmd: DriveRequest) => Promise<string | null>;
}) {
  const [err, setErr] = useState("");
  const armed = Boolean(body.session_running && body.drive_listening);
  const name = body.name || body.id;
  const episodic = (body.cards || []).filter((card) => card.mode === "episodic");
  const sendRef = useRef(send);
  sendRef.current = send;

  const dispatch = (cmd: DriveRequest) => {
    void sendRef.current(cmd).then((message) => setErr(message || ""));
  };

  useEffect(() => {
    if (!armed) return;
    const down = new Set<string>();
    let timer = 0;
    const pulse = () => {
      const twist = twistFromKeys(down);
      if (twist.x || twist.yaw) void sendRef.current({ twist });
    };
    const onDown = (ev: KeyboardEvent) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (typingIn(ev.target)) return;
      const k = ev.key.toLowerCase();
      if (k === " " || MOVE_KEYS.has(k)) ev.preventDefault();
      if (k === " ") {
        down.clear();
        if (timer) {
          window.clearInterval(timer);
          timer = 0;
        }
        void sendRef.current({ halt: true });
        return;
      }
      if (!MOVE_KEYS.has(k) || ev.repeat) return;
      down.add(k);
      pulse();
      if (!timer) timer = window.setInterval(pulse, 200);
    };
    const onUp = (ev: KeyboardEvent) => {
      const k = ev.key.toLowerCase();
      if (!MOVE_KEYS.has(k)) return;
      down.delete(k);
      if (down.size === 0 && timer) {
        window.clearInterval(timer);
        timer = 0;
        void sendRef.current({ halt: true });
      }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      if (timer) window.clearInterval(timer);
      if (down.size) void sendRef.current({ halt: true });
    };
  }, [armed]);

  let hint = "";
  if (!body.session_running) {
    hint = `先在本机 session start，再 python3 -m embody push --watch --body ${name}`;
  } else if (!body.drive_listening) {
    hint = `本机 python3 -m embody push --watch --body ${name} 之后才能从这里开`;
  }

  return (
    <div className="drive-pad">
      <div className="stat">
        <div className="label">开车</div>
        <div className="drive-grid">
          <HoldButton
            label="前进"
            disabled={!armed}
            onHold={() => dispatch({ twist: { x: WALK_X, y: 0, yaw: 0 } })}
            onRelease={() => dispatch({ halt: true })}
          />
          <HoldButton
            label="后退"
            disabled={!armed}
            onHold={() => dispatch({ twist: { x: -WALK_X, y: 0, yaw: 0 } })}
            onRelease={() => dispatch({ halt: true })}
          />
          <HoldButton
            label="左转"
            disabled={!armed}
            onHold={() => dispatch({ twist: { x: 0, y: 0, yaw: WALK_YAW } })}
            onRelease={() => dispatch({ halt: true })}
          />
          <HoldButton
            label="右转"
            disabled={!armed}
            onHold={() => dispatch({ twist: { x: 0, y: 0, yaw: -WALK_YAW } })}
            onRelease={() => dispatch({ halt: true })}
          />
          <button
            type="button"
            className="drive-btn halt"
            disabled={!armed}
            onClick={() => dispatch({ halt: true })}
          >
            停
          </button>
        </div>
        {hint ? (
          <p className="sub">{hint}</p>
        ) : (
          <p className="sub">WASD 走转 · 空格停 · 拖画布转视角 · 后到的指令赢</p>
        )}
        {err ? <p className="warn">{err}</p> : null}
      </div>
      {episodic.length ? (
        <div className="stat">
          <div className="label">招式</div>
          <div className="drive-tricks">
            {episodic.map((card: Card) => (
              <button
                key={card.alias}
                type="button"
                className="drive-btn"
                disabled={!armed}
                onClick={() => dispatch({ do: card.alias })}
              >
                {card.alias}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
