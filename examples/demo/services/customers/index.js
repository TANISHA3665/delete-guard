import express from 'express';
import { DeleteGuard } from 'delete-guard';

const URL = process.env.AMQP_URL ?? 'amqp://guest:guest@rabbitmq:5672';

const customers = new Set(['c1', 'c2']);
const guard = await DeleteGuard.connect({ url: URL, serviceName: 'customers' });

const app = express();
app.use(express.json());

app.delete('/customers/:id', async (req, res) => {
  const { id } = req.params;
  if (!customers.has(id)) return res.status(404).json({ error: 'not found' });

  const verdict = await guard.check({
    resource: 'customer',
    id,
    expect: ['orders', 'reviews'],
    timeoutMs: 2000,
    onTimeout: 'block',
  });

  if (!verdict.allowed) {
    const reasons = verdict.blockers.map((b) => b.detail ?? b.service);
    const missing = verdict.missing.length ? ` (no reply from: ${verdict.missing.join(', ')})` : '';
    return res.status(409).json({
      deleted: false,
      reason: reasons.join(', ') + missing,
      blockers: verdict.blockers,
      missing: verdict.missing,
    });
  }

  customers.delete(id);
  res.json({ deleted: true });
});

app.get('/health', (_req, res) => res.json({ service: 'customers', ok: true }));
app.listen(3000, () => console.log('customers coordinator on :3000'));
