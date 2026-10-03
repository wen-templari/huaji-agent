import { DurableObject } from 'cloudflare:workers';
import type { ReplyJobV1 } from '../../contracts/v1.ts';
import { replyJobV1Schema } from '../../contracts/v1.ts';

const CAPTURE_PREFIX = 'reply:';

export class HuajiBotReplyCapture extends DurableObject {
  async capture(value: unknown): Promise<void> {
    const job = replyJobV1Schema.parse(value);
    await this.ctx.storage.put(`${CAPTURE_PREFIX}${job.jobId}`, job);
  }

  async list(): Promise<ReplyJobV1[]> {
    const stored = await this.ctx.storage.list<unknown>({ prefix: CAPTURE_PREFIX });
    return [...stored.values()]
      .map((value) => replyJobV1Schema.parse(value))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async clear(): Promise<number> {
    const stored = await this.ctx.storage.list({ prefix: CAPTURE_PREFIX });
    if (stored.size > 0) await this.ctx.storage.delete([...stored.keys()]);
    return stored.size;
  }
}
