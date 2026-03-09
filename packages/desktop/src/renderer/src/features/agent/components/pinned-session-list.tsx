import debug from "debug";
import { memo, useState } from "react";

import { useLoadSession } from "../hooks/use-load-session";
import { useFilteredSessions } from "../hooks/use-unified-sessions";
import { useAgentStore } from "../store";
import { UnifiedSessionItem } from "./unified-session-item";

const log = debug("neovate:pinned-session-list");

export const PinnedSessionList = memo(function PinnedSessionList() {
  const activeSessionId = useAgentStore((s) => s.activeSessionId);
  const setActiveSession = useAgentStore((s) => s.setActiveSession);
  const loadSession = useLoadSession();
  const [restoring, setRestoring] = useState<string | null>(null);

  const items = useFilteredSessions({ filter: "pinned" });

  log("render: pinnedCount=%d", items.length);

  if (items.length === 0) return null;

  const handleLoad = async (sessionId: string) => {
    setRestoring(sessionId);
    try {
      await loadSession(sessionId);
    } finally {
      setRestoring((prev) => (prev === sessionId ? null : prev));
    }
  };

  return (
    <div className="pb-2">
      <ul className="flex flex-col">
        {items.map((item) => {
          const id = item.kind === "memory" ? item.session.sessionId : item.info.sessionId;
          return (
            <UnifiedSessionItem
              key={id}
              item={item}
              activeSessionId={activeSessionId}
              isPinned
              restoring={restoring}
              onActivate={setActiveSession}
              onLoad={handleLoad}
            />
          );
        })}
      </ul>
    </div>
  );
});
