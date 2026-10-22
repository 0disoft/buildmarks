/** Own every sibling request until it settles, retaining the first real failure. */
export class RepositoryRequestScope {
  private readonly controller = new AbortController();
  private readonly abortFromParent = () => this.controller.abort(this.parent.reason);
  private failure: { error: unknown } | undefined;

  constructor(private readonly parent: AbortSignal) {
    if (parent.aborted) this.abortFromParent();
    else parent.addEventListener("abort", this.abortFromParent, { once: true });
  }

  get signal(): AbortSignal { return this.controller.signal; }

  track<T>(operation: Promise<T>): Promise<T> {
    return operation.catch(error => {
      this.fail(error);
      throw error;
    });
  }

  async settle<T extends readonly unknown[]>(operations: T): Promise<{ -readonly [P in keyof T]: Awaited<T[P]> }> {
    try {
      return await Promise.all(operations);
    } catch (error) {
      this.fail(error);
      await Promise.allSettled(operations);
      throw this.failure!.error;
    }
  }

  dispose(): void {
    this.controller.abort();
    this.parent.removeEventListener("abort", this.abortFromParent);
  }

  private fail(error: unknown): void {
    if (this.failure !== undefined) return;
    this.failure = { error };
    this.controller.abort(error);
  }
}
