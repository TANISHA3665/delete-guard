import express from 'express';
import { DeleteGuard } from 'delete-guard';

const URL = process.env.AMQP_URL ?? 'amqp://guest:guest@rabbitmq:5672';

const reviews = { c1: 1, c2: 0 };

const guard = await DeleteGuard.connect({ url: URL, serviceName: 'reviews' });
await guard.registerChecker('customer', async (id) => {
  const count = reviews[id] ?? 0;
  return count > 0
    ? { referenced: true, count, detail: `${count} reviews` }
    : { referenced: false };
});

const app = express();
app.use(express.json());
app.delete('/reviews/:customerId', (req, res) => {
  reviews[req.params.customerId] = 0;
  res.json({ ok: true });
});
app.get('/health', (_req, res) => res.json({ service: 'reviews', ok: true }));
app.listen(3002, () => console.log('reviews checker on :3002'));
