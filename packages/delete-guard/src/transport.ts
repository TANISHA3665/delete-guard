import amqp from 'amqplib';
import type { CheckerResult, Reply } from './types.js';

const EXCHANGE = 'delete-guard';

interface CheckMessage {
  resource: string;
  id: string;
  correlationId: string;
  replyTo: string;
}

export class Transport {
  private constructor(
    // amqp.connect() returns a ChannelModel in @types/amqplib >=0.10.6;
    // createChannel/close live on ChannelModel, not Connection.
    private readonly conn: amqp.ChannelModel,
    private readonly channel: amqp.Channel,
    private replyQueue: string | null,
    private readonly pending: Map<string, (reply: Reply) => void>,
  ) {}

  static async connect(url: string): Promise<Transport> {
    const conn = await amqp.connect(url);
    const channel = await conn.createChannel();
    await channel.assertExchange(EXCHANGE, 'topic', { durable: false });
    return new Transport(conn, channel, null, new Map());
  }

  async ensureReplyQueue(): Promise<string> {
    if (this.replyQueue) return this.replyQueue;
    const q = await this.channel.assertQueue('', { exclusive: true, autoDelete: true });
    this.replyQueue = q.queue;
    await this.channel.consume(
      q.queue,
      (msg) => {
        if (!msg) return;
        const correlationId = msg.properties.correlationId as string;
        const handler = this.pending.get(correlationId);
        if (handler) handler(JSON.parse(msg.content.toString()) as Reply);
      },
      { noAck: true },
    );
    return this.replyQueue;
  }

  onReply(correlationId: string, cb: (reply: Reply) => void): void {
    this.pending.set(correlationId, cb);
  }

  clearReply(correlationId: string): void {
    this.pending.delete(correlationId);
  }

  publishCheck(msg: CheckMessage): void {
    const payload = Buffer.from(JSON.stringify({ resource: msg.resource, id: msg.id }));
    this.channel.publish(EXCHANGE, `check.${msg.resource}`, payload, {
      correlationId: msg.correlationId,
      replyTo: msg.replyTo,
    });
  }

  async bindChecker(
    serviceName: string,
    resource: string,
    handler: (id: string) => Promise<CheckerResult>,
  ): Promise<void> {
    const q = await this.channel.assertQueue(`${serviceName}.check.${resource}`, {
      durable: false,
      autoDelete: true,
    });
    await this.channel.bindQueue(q.queue, EXCHANGE, `check.${resource}`);
    await this.channel.consume(
      q.queue,
      async (msg) => {
        if (!msg) return;
        const { id } = JSON.parse(msg.content.toString()) as { id: string };
        let reply: Reply;
        try {
          reply = { service: serviceName, result: await handler(id) };
        } catch (err) {
          reply = { service: serviceName, result: { error: (err as Error).message } };
        }
        this.channel.sendToQueue(
          msg.properties.replyTo as string,
          Buffer.from(JSON.stringify(reply)),
          { correlationId: msg.properties.correlationId },
        );
        this.channel.ack(msg);
      },
      { noAck: false },
    );
  }

  async close(): Promise<void> {
    await this.channel.close();
    await this.conn.close();
  }
}
