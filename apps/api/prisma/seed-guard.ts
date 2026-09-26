export function assertSeedAllowed(nodeEnv: string | undefined): void {
  if (nodeEnv === 'production') {
    throw new Error('Sample catalog seed is disabled in production');
  }
}
