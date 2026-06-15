import type { Reply, CheckResult, Blocker } from './types.js';

export function decide(params: {
  expect: string[];
  replies: Reply[];
  onTimeout: 'block' | 'allow';
}): CheckResult {
  const { expect, replies, onTimeout } = params;
  const expected = new Set(expect);

  const responded = new Set<string>();
  const blockers: Blocker[] = [];

  for (const reply of replies) {
    if (!expected.has(reply.service)) continue;
    responded.add(reply.service);

    if ('error' in reply.result) {
      blockers.push({ service: reply.service, detail: `error: ${reply.result.error}` });
    } else if (reply.result.referenced) {
      blockers.push({
        service: reply.service,
        count: reply.result.count,
        detail: reply.result.detail,
      });
    }
  }

  const missing = expect.filter((s) => !responded.has(s));
  const missingBlocks = missing.length > 0 && onTimeout === 'block';
  const allowed = blockers.length === 0 && !missingBlocks;

  return { allowed, blockers, missing };
}
