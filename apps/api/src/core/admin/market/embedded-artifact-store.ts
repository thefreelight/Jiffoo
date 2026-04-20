import path from 'path';
import { promises as fs } from 'fs';

type ArtifactKind = 'theme' | 'plugin';
type SidecarKind = 'artifact' | 'checksum' | 'signature';

let cachedArtifactRoot: string | null | undefined;

function getArtifactRootCandidates(): string[] {
  return [
    process.env.OFFICIAL_ARTIFACTS_DIR,
    path.join(process.cwd(), 'dist', 'official-artifacts'),
    path.join(process.cwd(), 'official-artifacts'),
  ].filter((value): value is string => Boolean(value));
}

function getArtifactDirectory(kind: ArtifactKind): 'themes' | 'plugins' {
  return kind === 'theme' ? 'themes' : 'plugins';
}

function getArtifactExtension(kind: ArtifactKind): string {
  return kind === 'theme' ? 'jtheme' : 'jplugin';
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function getEmbeddedOfficialArtifactsRoot(): Promise<string | null> {
  if (cachedArtifactRoot !== undefined) {
    return cachedArtifactRoot;
  }

  for (const candidate of getArtifactRootCandidates()) {
    if (await pathExists(candidate)) {
      cachedArtifactRoot = candidate;
      return candidate;
    }
  }

  cachedArtifactRoot = null;
  return null;
}

export function resetEmbeddedOfficialArtifactsRootCache(): void {
  cachedArtifactRoot = undefined;
}

export async function resolveEmbeddedOfficialArtifactPath(
  kind: ArtifactKind,
  slug: string,
  version: string,
  sidecar: SidecarKind = 'artifact',
): Promise<string | null> {
  const root = await getEmbeddedOfficialArtifactsRoot();
  if (!root) {
    return null;
  }

  const baseFileName = `${version}.${getArtifactExtension(kind)}`;
  const fileName =
    sidecar === 'artifact'
      ? baseFileName
      : sidecar === 'checksum'
        ? `${baseFileName}.sha256`
        : `${baseFileName}.sig`;

  const artifactPath = path.join(root, getArtifactDirectory(kind), slug, fileName);
  return (await pathExists(artifactPath)) ? artifactPath : null;
}

export async function hasEmbeddedOfficialArtifact(
  kind: ArtifactKind,
  slug: string,
  version: string,
): Promise<boolean> {
  return Boolean(await resolveEmbeddedOfficialArtifactPath(kind, slug, version));
}
