import { readFile } from 'fs/promises';
import path from 'path';

const INSTALL_SCRIPT_CANDIDATES = [
  path.resolve(process.cwd(), 'install.sh'),
  path.resolve(process.cwd(), '../../install.sh'),
  path.resolve(process.cwd(), '../../../install.sh'),
];

async function loadInstallScript(): Promise<string> {
  for (const candidate of INSTALL_SCRIPT_CANDIDATES) {
    try {
      return await readFile(candidate, 'utf8');
    } catch {
      // Try the next candidate path.
    }
  }

  throw new Error('Install script not found');
}

export async function GET() {
  try {
    const script = await loadInstallScript();

    return new Response(script, {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'public, max-age=60',
      },
    });
  } catch (error) {
    return new Response('Install script unavailable\n', { status: 404 });
  }
}
