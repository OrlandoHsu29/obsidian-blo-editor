/** Safe, serialized handoff between independent views of one Markdown file. */
export class NoteSyncConflict extends Error {
  constructor() { super('note-sync-conflict'); }
}

export interface NoteSyncView {
  isCurrent(): boolean;
  isDirty(): boolean;
  save(): Promise<void>;
  savedContent(): string;
  reload(): Promise<void>;
  lock(): () => void;
}

const elementLocks = new WeakMap<HTMLElement, { count: number; block: EventListener }>();
const blockedEvents = ['keydown', 'beforeinput', 'paste', 'cut', 'drop', 'compositionstart', 'click'];
export function lockElement(element: HTMLElement): () => void {
  let state = elementLocks.get(element);
  if (!state) {
    const block: EventListener = event => {
      if (!event.target || !element.contains(event.target as Node)) return;
      if (event.cancelable) event.preventDefault();
      event.stopImmediatePropagation();
    };
    state = { count: 0, block };
    for (const type of blockedEvents) element.ownerDocument.addEventListener(type, block, {capture:true});
    elementLocks.set(element, state);
  }
  state.count++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--state!.count === 0) {
      for (const type of blockedEvents) element.ownerDocument.removeEventListener(type, state!.block, {capture:true});
      elementLocks.delete(element);
    }
  };
}

export function validateWrite(base: string, disk: string, content: string): string {
  if (disk !== base && disk !== content) throw new NoteSyncConflict();
  return content;
}

export class NoteSync {
  private pending: Promise<void> = Promise.resolve();

  handoff(target: NoteSyncView, others: NoteSyncView[], read: () => Promise<string>): Promise<void> {
    // Block editing in every participating view until the handoff is complete.
    const unlock = [target, ...others].map(view => view.lock());
    const task = this.pending.catch(() => {}).then(async () => {
      if (!target.isCurrent()) return;
      const views = [target, ...others.filter(view => view.isCurrent())];
      const changed = views.filter(view => view.isDirty());
      if (changed.length > 1) throw new NoteSyncConflict();
      if (changed.length === 1) {
        await changed[0].save();
        if (!target.isCurrent()) return;
        if (changed[0].isCurrent() && changed[0].isDirty()) throw new NoteSyncConflict();
      }
      if (!target.isCurrent()) return;
      const disk = await read();
      if (!target.isCurrent()) return;
      if (target.isDirty()) throw new NoteSyncConflict();
      if (disk !== target.savedContent()) await target.reload();
    }).finally(() => { for (const release of unlock.reverse()) release(); });
    this.pending = task.catch(() => {});
    return task;
  }
}
