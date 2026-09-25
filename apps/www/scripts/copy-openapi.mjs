// The API reference page serves the spec from /openapi.yaml; keep one source of truth in packages/openapi.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, '../public'), { recursive: true });
copyFileSync(join(here, '../../../packages/openapi/openapi.yaml'), join(here, '../public/openapi.yaml'));
copyFileSync(join(here, '../../../packages/openapi/openapi.yaml'), join(here, '../content/openapi.yaml'));
