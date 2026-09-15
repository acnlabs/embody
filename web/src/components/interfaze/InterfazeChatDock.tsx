"use client";

import { useEffect, useState } from "react";
import InterfazeChat from "@/components/interfaze/InterfazeChat";
import { useI18n } from "@/lib/i18n";

const TITLE_ID = "interfaze-chat-title";

export default function InterfazeChatDock({
  agentId,
  agentName,
  bodyId,
  open,
  onClose,
}: {
  agentId: string;
  agentName?: string;
  bodyId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [kept, setKept] = useState(open);
  const title = agentName?.trim()
    ? t("interfaze.chatWith", { name: agentName.trim() })
    : t("interfaze.title");

  useEffect(() => {
    if (open) setKept(true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.documentElement.classList.add("interfaze-dock-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("interfaze-dock-open");
    };
  }, [open, onClose]);

  if (!kept) return null;

  return (
    <>
      {open ? (
        <button
          type="button"
          className="interfaze-scrim"
          aria-label={t("interfaze.close")}
          onClick={onClose}
        />
      ) : null}
      <aside
        className={`interfaze-dock${open ? " open" : ""}`}
        role="dialog"
        aria-modal={open}
        aria-hidden={!open}
        aria-labelledby={TITLE_ID}
        inert={!open}
      >
        <div className="interfaze-dock-head">
          <h2 id={TITLE_ID}>{title}</h2>
          <button type="button" onClick={onClose} aria-label={t("interfaze.close")}>
            ✕
          </button>
        </div>
        {agentId ? (
          <div className="interfaze-dock-body">
            <InterfazeChat agentId={agentId} bodyId={bodyId} fill />
          </div>
        ) : null}
      </aside>
    </>
  );
}
