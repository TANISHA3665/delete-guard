import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RabbitMQContainer, StartedRabbitMQContainer } from '@testcontainers/rabbitmq';
import { DeleteGuard } from '../src/index.js';

let container: StartedRabbitMQContainer;
let url: string;

beforeAll(async () => {
  container = await new RabbitMQContainer('rabbitmq:3.13-management').start();
  url = container.getAmqpUrl();
}, 60_000);

afterAll(async () => {
  await container.stop();
});

describe('DeleteGuard integration', () => {
  it('blocks when a checker reports references, allows when clear', async () => {
    const orders = await DeleteGuard.connect({ url, serviceName: 'orders' });
    const reviews = await DeleteGuard.connect({ url, serviceName: 'reviews' });
    const customers = await DeleteGuard.connect({ url, serviceName: 'customers' });

    const orderCounts: Record<string, number> = { c1: 2, c2: 0 };
    await orders.registerChecker('customer', async (id) =>
      orderCounts[id] > 0
        ? { referenced: true, count: orderCounts[id], detail: `${orderCounts[id]} open orders` }
        : { referenced: false },
    );
    await reviews.registerChecker('customer', async () => ({ referenced: false }));

    const blocked = await customers.check({
      resource: 'customer',
      id: 'c1',
      expect: ['orders', 'reviews'],
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.blockers).toContainEqual({ service: 'orders', count: 2, detail: '2 open orders' });

    const allowed = await customers.check({
      resource: 'customer',
      id: 'c2',
      expect: ['orders', 'reviews'],
    });
    expect(allowed.allowed).toBe(true);

    await Promise.all([orders.close(), reviews.close(), customers.close()]);
  });

  it('fails closed when an expected checker never registered', async () => {
    const customers = await DeleteGuard.connect({ url, serviceName: 'customers2' });
    const result = await customers.check({
      resource: 'customer',
      id: 'c1',
      expect: ['nobody'],
      timeoutMs: 500,
    });
    expect(result.allowed).toBe(false);
    expect(result.missing).toEqual(['nobody']);
    await customers.close();
  });
});
