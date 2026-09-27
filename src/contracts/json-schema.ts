import { z } from 'zod';
import { ingressEventV1Schema, replyJobV1Schema } from './v1.ts';

function toContractJsonSchema(
  schema: z.ZodType,
  id: string,
  title: string,
): Record<string, unknown> {
  const { $schema, ...body } = z.toJSONSchema(schema, {
    target: 'draft-2020-12',
    reused: 'ref',
    cycles: 'ref',
  });

  return {
    $schema,
    $id: id,
    title,
    ...body,
  };
}

export function createContractJsonSchemas() {
  return {
    ingress: toContractJsonSchema(
      ingressEventV1Schema,
      'https://github.com/nbtca/huaji-agent/contracts/v1/ingress.schema.json',
      'HuaJiBot ingress event v1',
    ),
    replyJob: toContractJsonSchema(
      replyJobV1Schema,
      'https://github.com/nbtca/huaji-agent/contracts/v1/reply-job.schema.json',
      'HuaJiBot reply job v1',
    ),
  };
}
