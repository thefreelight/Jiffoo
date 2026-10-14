type NavigationGuard = (resume: () => void) => boolean;
const guards = new Set<NavigationGuard>();

export function registerNavigationGuard(guard: NavigationGuard): () => void {
  guards.add(guard);
  return () => { guards.delete(guard); };
}

export function requestAppNavigation(action: () => void): void {
  for (const guard of [...guards].reverse()) if (guard(action)) return;
  action();
}
