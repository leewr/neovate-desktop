import { useCallback } from "react";
import debug from "debug";
import { client } from "../../../orpc";
import { useAcpStore } from "../store";
import { useProjectStore } from "../../project/store";

const newSessionLog = debug("neovate:acp-new-session");

export function useAcpNewSession() {
  const createSession = useAcpStore((s) => s.createSession);
  const setAvailableCommands = useAcpStore((s) => s.setAvailableCommands);

  const createNewSession = useCallback(
    async (connectionId: string) => {
      // Dedup guard: if active session is already new (empty), reuse it
      const { activeSessionId, sessions } = useAcpStore.getState();
      if (activeSessionId) {
        const active = sessions.get(activeSessionId);
        if (active?.isNew) {
          newSessionLog("createNewSession: reusing empty session %s", activeSessionId);
          return activeSessionId;
        }
      }

      newSessionLog("createNewSession: creating session", { connectionId });
      const { sessionId, commands } = await client.acp.newSession({ connectionId });
      newSessionLog("createNewSession: created %s", sessionId);

      const projectPath = useProjectStore.getState().activeProject?.path;
      createSession(sessionId, connectionId, {
        cwd: projectPath,
        isNew: true,
      });

      if (commands?.length) {
        setAvailableCommands(sessionId, commands);
      }

      return sessionId;
    },
    [createSession, setAvailableCommands],
  );

  return { createNewSession };
}
