# Invalidate Prewarmed Sessions on Global Model Change

## Problem

When the user changes the global model in **Settings > Chat > Model**, the change is persisted via `setGlobalModelSelection()` but no existing sessions are invalidated. Prewarmed sessions (`isNew: true`) still have the old model baked in — they were initialized with the previous model setting via `SessionManager.createSession()` at creation time.

When the user later creates a new chat, `findPreWarmedSession()` finds the stale prewarmed session and reuses it with the wrong model.

## Scope

- Only affects `isNew` sessions (prewarmed / empty / unused)
- Both active (user is looking at an empty chat) and background prewarmed sessions are invalidated
- All `isNew` sessions are invalidated regardless of model scope — no attempt to filter by scope
- Already-in-use sessions (`isNew: false`) are not affected
- Provider changes do not trigger invalidation (separate concern)
- New sessions are created lazily — no immediate re-prewarm after invalidation

## Approach

New method on `ClaudeCodeChatManager` called from the settings panel.

## Changes

### 1. `chat-manager.ts` — Add `invalidateNewSessions()`

**File:** `src/renderer/src/features/agent/chat-manager.ts`

```ts
async invalidateNewSessions(cwd?: string): Promise<void> {
  const store = useAgentStore.getState();
  let removedActive = false;

  for (const [id, session] of store.sessions) {
    if (session.isNew) {
      if (id === store.activeSessionId) removedActive = true;
      await this.removeSession(id);
      useAgentStore.getState().removeSession(id);
    }
  }

  // Replace the active session so the user isn't left in a broken state.
  // Without this, activeSessionId is null — the WelcomePanel renders but
  // handleSend silently drops messages (guard: `if (!activeSessionId) return`),
  // and the auto-create effect in AgentChat won't re-fire because
  // initializedPathRef is already set for the current project.
  // Same pattern as archiveSession in project/store.ts.
  if (removedActive && cwd) {
    const result = await this.createSession(cwd);
    registerSessionInStore(result.sessionId, cwd, result, true);
  }
}
```

Tears down both the SDK subprocess (via `this.removeSession`) and the renderer state (via `useAgentStore.getState().removeSession`). If the active session was an empty chat, creates a replacement session that picks up the just-persisted model setting.

### 2. `chat-panel.tsx` — Call `invalidateNewSessions()` in `handleSelect`

**File:** `src/renderer/src/features/settings/components/panels/chat-panel.tsx`

```ts
const handleSelect = useCallback((value: unknown) => {
  const { providerId, model } = decodeValue(value as string);
  setSelectedProviderId(providerId ?? undefined);
  setSelectedModel(model ?? undefined);
  client.config.setGlobalModelSelection({ providerId, model });
  const projectPath = useProjectStore.getState().activeProject?.path;
  claudeCodeChatManager.invalidateNewSessions(projectPath);
}, []);
```

New imports: `claudeCodeChatManager` from `../../../agent/chat-manager`, `useProjectStore` from `../../../project/store`.

## Files Modified

| File                                                                  | Change                                                                                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/renderer/src/features/agent/chat-manager.ts`                     | Add `invalidateNewSessions()` method                                                                                     |
| `src/renderer/src/features/settings/components/panels/chat-panel.tsx` | Call `invalidateNewSessions(cwd)` after persisting model selection, import `claudeCodeChatManager` and `useProjectStore` |
