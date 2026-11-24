'use client';

/**
 * One Save button per plugin page. Every editable section registers its
 * unsaved state and its persist function here; the page header renders the
 * single Save control from the registry instead of each card carrying its own.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface PluginSaveContribution {
  /** Stable id of the contributing section. */
  id: string;
  dirty: boolean;
  /** Persist this section; throw after surfacing its own error to stay dirty. */
  save: () => Promise<void> | void;
}

export interface PluginSaveRegistry {
  /** True while any registered section has unsaved edits. */
  hasDirty: boolean;
  /** True while the page-level Save is running. */
  saving: boolean;
  /** Whether at least one section is registered, i.e. the page has something to save. */
  registered: boolean;
  /** Persists every dirty section in turn. Resolves false when a section failed. */
  save: () => Promise<boolean>;
}

interface PluginSaveInternals {
  register: (contribution: PluginSaveContribution) => void;
  unregister: (id: string) => void;
}

// The registration functions and the observable state travel on separate
// contexts: a section's registration effect depends on the (stable) functions,
// so a state change caused by another section never re-triggers it.
const PluginSaveInternalsContext = createContext<PluginSaveInternals | null>(null);
const PluginSaveStateContext = createContext<PluginSaveRegistry | null>(null);

const emptyRegistry: PluginSaveRegistry = {
  hasDirty: false,
  saving: false,
  registered: false,
  save: async () => false,
};

export function PluginSaveProvider({ children }: { children: ReactNode }) {
  const [contributions, setContributions] = useState<Record<string, PluginSaveContribution>>({});
  const [saving, setSaving] = useState(false);
  // The save pass reads the latest registrations without re-creating the callback.
  const contributionsRef = useRef(contributions);
  useEffect(() => {
    contributionsRef.current = contributions;
  }, [contributions]);

  const register = useCallback((contribution: PluginSaveContribution) => {
    setContributions((current) => {
      const existing = current[contribution.id];
      // Sections re-register with a fresh object on every effect run; only a
      // change in state is worth a re-render.
      if (existing && existing.dirty === contribution.dirty) return current;
      return { ...current, [contribution.id]: contribution };
    });
  }, []);

  const unregister = useCallback((id: string) => {
    setContributions((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const save = useCallback(async () => {
    const dirtySections = Object.values(contributionsRef.current).filter((section) => section.dirty);
    if (dirtySections.length === 0) return true;

    setSaving(true);
    try {
      for (const section of dirtySections) {
        // Each section surfaces its own error; a throw keeps it dirty and stops the pass.
        await section.save();
      }
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const internals = useMemo<PluginSaveInternals>(() => ({ register, unregister }), [register, unregister]);
  const state = useMemo<PluginSaveRegistry>(
    () => ({
      hasDirty: Object.values(contributions).some((section) => section.dirty),
      saving,
      registered: Object.keys(contributions).length > 0,
      save,
    }),
    [contributions, save, saving],
  );

  return (
    <PluginSaveInternalsContext.Provider value={internals}>
      <PluginSaveStateContext.Provider value={state}>{children}</PluginSaveStateContext.Provider>
    </PluginSaveInternalsContext.Provider>
  );
}

export function usePluginSaveRegistry(): PluginSaveRegistry {
  const registry = useContext(PluginSaveStateContext);
  return registry ?? emptyRegistry;
}

/**
 * Hand this section's unsaved edits to the page-level Save. The latest `save`
 * closure is kept in a ref that is refreshed after every render, so callers may
 * pass a new function each time. A section with nothing to persist (an empty
 * schema) passes `enabled: false` so the page does not offer a Save for it.
 */
export function usePluginSaveContribution(
  id: string,
  dirty: boolean,
  save: () => Promise<void> | void,
  enabled = true,
): void {
  const internals = useContext(PluginSaveInternalsContext);
  const saveRef = useRef(save);

  useEffect(() => {
    saveRef.current = save;
  });

  useEffect(() => {
    if (!internals || !enabled) return;
    const contribution: PluginSaveContribution = { id, dirty, save: () => saveRef.current() };
    internals.register(contribution);
    return () => internals.unregister(id);
  }, [internals, id, dirty, enabled]);
}
