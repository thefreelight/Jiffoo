export function inferUpdaterBridgeUrl(): string | null {
  return process.env.JIFFOO_UPDATER_URL || null;
}
