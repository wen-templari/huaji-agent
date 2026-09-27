import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createContractJsonSchemas } from '../src/contracts/json-schema.ts';

const contractsRoot = path.resolve(import.meta.dirname, '../contracts/v1');
const schemas = createContractJsonSchemas();

await Promise.all([
  writeFile(
    path.join(contractsRoot, 'ingress.schema.json'),
    `${JSON.stringify(schemas.ingress, null, 2)}\n`,
  ),
  writeFile(
    path.join(contractsRoot, 'reply-job.schema.json'),
    `${JSON.stringify(schemas.replyJob, null, 2)}\n`,
  ),
]);
