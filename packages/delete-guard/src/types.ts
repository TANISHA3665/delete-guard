/** What a checker returns about a single entity id. */
export type CheckerResult =
  | { referenced: false }
  | { referenced: true; count?: number; detail?: string };

/** Handler a checker registers for a resource type. */
export type CheckerHandler = (id: string) => Promise<CheckerResult>;

/** A coordinator's request to validate a delete. */
export interface CheckRequest {
  resource: string;
  id: string;
  /** Services that must answer for the decision to be complete. */
  expect: string[];
  /** Default 2000. */
  timeoutMs?: number;
  /** Behaviour when an expected service does not reply. Default 'block'. */
  onTimeout?: 'block' | 'allow';
}

/** A service that prevents (or failed to clear) the delete. */
export interface Blocker {
  service: string;
  count?: number;
  detail?: string;
}

/** Final decision returned to the coordinator. */
export interface CheckResult {
  allowed: boolean;
  blockers: Blocker[];
  /** Expected services that did not reply in time. */
  missing: string[];
}

/** Internal: one reply collected during aggregation. */
export interface Reply {
  service: string;
  result: CheckerResult | { error: string };
}
