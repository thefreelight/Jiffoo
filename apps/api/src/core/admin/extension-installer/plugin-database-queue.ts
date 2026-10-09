import { ApiError } from '@/utils/api-errors';

type Waiter = { grant: (release: () => void) => void; reject: (error: ApiError) => void; cleanup: () => void };

/** FIFO within a slug and round-robin across slugs, independent of pg's queue. */
export class PluginDatabaseQueue {
  private readonly waiting = new Map<string, Waiter[]>();
  private readonly active = new Map<string, number>();
  private readonly rotation: string[] = [];
  private total = 0;
  private closed = false;
  constructor(readonly perPlugin: number, readonly capacity = perPlugin * 2, readonly queueCap = 64) {}

  acquire(slug: string, signal: AbortSignal, deadlineMs: number): Promise<() => void> {
    if (this.closed) return Promise.reject(new ApiError('DATABASE_UNAVAILABLE'));
    if (signal.aborted) return Promise.reject(new ApiError('PLUGIN_TIMEOUT'));
    if ((this.waiting.get(slug)?.length ?? 0) >= this.queueCap) return Promise.reject(new ApiError('PLUGIN_DATABASE_BUSY'));
    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout;
      const remove = (error: ApiError) => {
        const queue = this.waiting.get(slug);
        const index = queue?.indexOf(waiter) ?? -1;
        if (index < 0) return;
        queue!.splice(index, 1); waiter.cleanup(); reject(error); this.pump();
      };
      const abort = () => remove(new ApiError('PLUGIN_TIMEOUT'));
      const waiter: Waiter = { grant: resolve, reject, cleanup: () => { clearTimeout(timer); signal.removeEventListener('abort', abort); } };
      const queue = this.waiting.get(slug);
      if (queue) queue.push(waiter);
      else { this.waiting.set(slug, [waiter]); this.rotation.push(slug); }
      signal.addEventListener('abort', abort, { once: true });
      timer = setTimeout(() => remove(new ApiError('PLUGIN_DATABASE_BUSY')), deadlineMs);
      this.pump();
    });
  }

  private pump(): void {
    let scanned = 0;
    while (!this.closed && this.total < this.capacity && this.rotation.length && scanned < this.rotation.length) {
      const slug = this.rotation.shift()!;
      const queue = this.waiting.get(slug)!;
      if (!queue.length) { this.waiting.delete(slug); scanned = 0; continue; }
      if ((this.active.get(slug) ?? 0) >= this.perPlugin) { this.rotation.push(slug); scanned++; continue; }
      const waiter = queue.shift()!;
      if (queue.length) this.rotation.push(slug); else this.waiting.delete(slug);
      scanned = 0; this.total++; this.active.set(slug, (this.active.get(slug) ?? 0) + 1);
      waiter.cleanup(); let released = false;
      waiter.grant(() => {
        if (released) return;
        released = true; this.total--;
        const count = this.active.get(slug)! - 1;
        if (count) this.active.set(slug, count); else this.active.delete(slug);
        this.pump();
      });
    }
  }

  snapshot(slug: string) { return { active: this.active.get(slug) ?? 0, queued: this.waiting.get(slug)?.length ?? 0, total: this.total }; }
  close(): void {
    this.closed = true;
    for (const queue of this.waiting.values()) for (const waiter of queue) { waiter.cleanup(); waiter.reject(new ApiError('DATABASE_UNAVAILABLE')); }
    this.waiting.clear(); this.rotation.splice(0);
  }
}
