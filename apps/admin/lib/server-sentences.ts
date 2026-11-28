/**
 * Sentences the core sends in English with its upgrade status, and the key each is written under in the dictionary.
 * The page shows such a sentence in the store's language when it is one of these; any other sentence the core sends
 * is shown as it came. When the core sends a code instead of a sentence, this table goes.
 */
const SENTENCE_KEYS: Record<string, string> = {
  'Cloudflare-native runtime manages deployments through the platform release pipeline.': 'merchant.systemUpdates.reasonDeploymentMode',
  'Cloudflare-native instances are upgraded through the published Worker release pipeline.': 'merchant.systemUpdates.reasonOneClickBlocked',
  'Current Cloudflare-native runtime release.': 'merchant.systemUpdates.releaseNotesCurrent',
};

/** The dictionary key of a sentence the core sent, or null for one this table does not know. */
export function serverSentenceKey(sentence: string | null | undefined): string | null {
  if (!sentence) return null;
  return SENTENCE_KEYS[sentence.trim()] ?? null;
}
