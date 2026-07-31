export interface ExecutionLimitKey {
  userId: string;
  workspaceId: string;
}

export type ExecutionLimitResult =
  | { kind: "accepted"; release: () => void }
  | {
      kind: "rejected";
      reason: "rate" | "concurrency";
      retryAfterMs: number;
    };

export interface ExecutionLimiter {
  acquire(key: ExecutionLimitKey): ExecutionLimitResult;
}

export interface ExecutionLimitOptions {
  windowMs: number;
  maxPerUserPerWindow: number;
  maxPerWorkspacePerWindow: number;
  maxConcurrentPerUser: number;
  maxConcurrentPerWorkspace: number;
  now?: () => number;
}

interface LimitState {
  active: number;
  timestamps: number[];
}

export class InMemoryExecutionLimiter implements ExecutionLimiter {
  private readonly users = new Map<string, LimitState>();
  private readonly workspaces = new Map<string, LimitState>();
  private readonly now: () => number;
  private acquisitions = 0;

  constructor(private readonly options: ExecutionLimitOptions) {
    this.now = options.now ?? Date.now;
  }

  acquire(key: ExecutionLimitKey): ExecutionLimitResult {
    const now = this.now();
    this.acquisitions += 1;
    if (this.acquisitions % 256 === 0) this.sweep(now);
    const user = this.state(this.users, key.userId, now);
    const workspace = this.state(this.workspaces, key.workspaceId, now);

    if (
      user.active >= this.options.maxConcurrentPerUser ||
      workspace.active >= this.options.maxConcurrentPerWorkspace
    ) {
      return { kind: "rejected", reason: "concurrency", retryAfterMs: 1_000 };
    }

    const userRetry = retryAfter(
      user.timestamps,
      this.options.maxPerUserPerWindow,
      now,
      this.options.windowMs,
    );
    const workspaceRetry = retryAfter(
      workspace.timestamps,
      this.options.maxPerWorkspacePerWindow,
      now,
      this.options.windowMs,
    );
    if (userRetry > 0 || workspaceRetry > 0) {
      return {
        kind: "rejected",
        reason: "rate",
        retryAfterMs: Math.max(userRetry, workspaceRetry),
      };
    }

    user.timestamps.push(now);
    workspace.timestamps.push(now);
    user.active += 1;
    workspace.active += 1;
    let released = false;
    return {
      kind: "accepted",
      release: () => {
        if (released) return;
        released = true;
        user.active = Math.max(0, user.active - 1);
        workspace.active = Math.max(0, workspace.active - 1);
        this.removeIdleState(this.users, key.userId, user);
        this.removeIdleState(this.workspaces, key.workspaceId, workspace);
      },
    };
  }

  private state(
    states: Map<string, LimitState>,
    key: string,
    now: number,
  ): LimitState {
    const state = states.get(key) ?? { active: 0, timestamps: [] };
    state.timestamps = state.timestamps.filter(
      (timestamp) => timestamp > now - this.options.windowMs,
    );
    states.set(key, state);
    return state;
  }

  private removeIdleState(
    states: Map<string, LimitState>,
    key: string,
    state: LimitState,
  ): void {
    if (state.active === 0 && state.timestamps.length === 0) {
      states.delete(key);
    }
  }

  private sweep(now: number): void {
    for (const states of [this.users, this.workspaces]) {
      for (const [key, state] of states) {
        state.timestamps = state.timestamps.filter(
          (timestamp) => timestamp > now - this.options.windowMs,
        );
        this.removeIdleState(states, key, state);
      }
    }
  }
}

function retryAfter(
  timestamps: number[],
  maximum: number,
  now: number,
  windowMs: number,
): number {
  if (timestamps.length < maximum) return 0;
  return Math.max(1, timestamps[0]! + windowMs - now);
}
