import { randomUUID } from 'node:crypto';
import { Transport } from './transport.js';
import { decide } from './aggregator.js';
import type { CheckRequest, CheckResult, CheckerHandler, Reply } from './types.js';

export interface DeleteGuardOptions {
  url: string;
  serviceName: string;
}

export class DeleteGuard {
  private constructor(
    private readonly transport: Transport,
    private readonly serviceName: string,
  ) {}

  static async connect(opts: DeleteGuardOptions): Promise<DeleteGuard> {
    const transport = await Transport.connect(opts.url);
    return new DeleteGuard(transport, opts.serviceName);
  }

  async registerChecker(resource: string, handler: CheckerHandler): Promise<void> {
    await this.transport.bindChecker(this.serviceName, resource, handler);
  }

  async check(req: CheckRequest): Promise<CheckResult> {
    const timeoutMs = req.timeoutMs ?? 2000;
    const onTimeout = req.onTimeout ?? 'block';
    const correlationId = randomUUID();
    const replyTo = await this.transport.ensureReplyQueue();

    const replies: Reply[] = [];
    const seen = new Set<string>();
    const expected = new Set(req.expect);

    const result = await new Promise<CheckResult>((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        this.transport.clearReply(correlationId);
        resolve(decide({ expect: req.expect, replies, onTimeout }));
      };

      const timer = setTimeout(finish, timeoutMs);

      this.transport.onReply(correlationId, (reply) => {
        if (seen.has(reply.service)) return;
        seen.add(reply.service);
        replies.push(reply);
        if (req.expect.every((s) => seen.has(s)) && expected.size > 0) finish();
      });

      this.transport.publishCheck({ resource: req.resource, id: req.id, correlationId, replyTo });
    });

    return result;
  }

  async close(): Promise<void> {
    await this.transport.close();
  }
}
