import express from 'express';
import { DeleteGuard } from 'delete-guard';

const URL = process.env.AMQP_URL ?? 'amqp://guest:guest@rabbitmq:5672';

const orders = { c1: 2, c2: 0 };

const guard = await DeleteGuard.connect({ url: URL, serviceName: 'orders' });
await guard.registerChecker('customer', async (id) => {
  const count = orders[id] ?? 0;
  return count > 0
    ? { referenced: true, count, detail: `${count} open orders` }
    : { referenced: false };
});

const app = express();
app.use(express.json());
app.delete('/orders/:customerId', (req, res) => {
  orders[req.params.customerId] = 0;
  res.json({ ok: true });
});
app.get('/health', (_req, res) => res.json({ service: 'orders', ok: true }));
app.listen(3001, () => console.log('orders checker on :3001'));
