const stages = ['materialize', 'publish', 'lease'] as const;

export function assertThemeTestHooks(): void {
  const stage = process.env.JIFFOO_TEST_THEME_BARRIER;
  if (stage === undefined) return;
  if (process.env.NODE_ENV !== 'test' || !stages.includes(stage as typeof stages[number])) {
    throw new Error('Theme test barriers require NODE_ENV=test and a supported stage');
  }
}

export async function themeTestBarrier(stage: typeof stages[number], slug: string, packageHash?: string): Promise<void> {
  if (process.env.NODE_ENV !== 'test' || process.env.JIFFOO_TEST_THEME_BARRIER !== stage || !process.send) return;
  process.send({ kind: 'theme-barrier', stage, slug, packageHash });
  await new Promise<void>(resolve => {
    const receive = (message: unknown) => {
      const value = message as { kind?: string; stage?: string; slug?: string; packageHash?: string };
      if (value.kind !== 'theme-release' || value.stage !== stage || value.slug !== slug || value.packageHash !== packageHash) return;
      process.off('message', receive); resolve();
    };
    process.on('message', receive);
  });
}
