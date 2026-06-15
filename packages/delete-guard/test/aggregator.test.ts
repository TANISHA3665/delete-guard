import { describe, it, expect } from 'vitest';
import { decide } from '../src/aggregator.js';
import type { Reply } from '../src/types.js';

const r = (service: string, result: Reply['result']): Reply => ({ service, result });

describe('decide', () => {
  it('allows when every expected service replies not-referenced', () => {
    const out = decide({
      expect: ['orders', 'reviews'],
      replies: [r('orders', { referenced: false }), r('reviews', { referenced: false })],
      onTimeout: 'block',
    });
    expect(out).toEqual({ allowed: true, blockers: [], missing: [] });
  });

  it('blocks and records a blocker when a service is referenced', () => {
    const out = decide({
      expect: ['orders', 'reviews'],
      replies: [
        r('orders', { referenced: true, count: 2, detail: '2 open orders' }),
        r('reviews', { referenced: false }),
      ],
      onTimeout: 'block',
    });
    expect(out.allowed).toBe(false);
    expect(out.blockers).toEqual([{ service: 'orders', count: 2, detail: '2 open orders' }]);
    expect(out.missing).toEqual([]);
  });

  it('blocks (fail-closed) when an expected service is missing', () => {
    const out = decide({
      expect: ['orders', 'reviews'],
      replies: [r('orders', { referenced: false })],
      onTimeout: 'block',
    });
    expect(out.allowed).toBe(false);
    expect(out.missing).toEqual(['reviews']);
  });

  it('allows a missing service when onTimeout is allow and nothing is referenced', () => {
    const out = decide({
      expect: ['orders', 'reviews'],
      replies: [r('orders', { referenced: false })],
      onTimeout: 'allow',
    });
    expect(out.allowed).toBe(true);
    expect(out.missing).toEqual(['reviews']);
  });

  it('treats a checker error as a blocker', () => {
    const out = decide({
      expect: ['orders'],
      replies: [r('orders', { error: 'db down' })],
      onTimeout: 'allow',
    });
    expect(out.allowed).toBe(false);
    expect(out.blockers).toEqual([{ service: 'orders', detail: 'error: db down' }]);
  });

  it('ignores replies from services not in expect', () => {
    const out = decide({
      expect: ['orders'],
      replies: [r('orders', { referenced: false }), r('ghost', { referenced: true })],
      onTimeout: 'block',
    });
    expect(out.allowed).toBe(true);
    expect(out.blockers).toEqual([]);
  });
});
