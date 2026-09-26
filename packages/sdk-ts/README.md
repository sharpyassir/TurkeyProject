# @pgcloud/sdk

TypeScript and JavaScript client for the pgcloud API. Works in Node 20 and newer and in any runtime with `fetch`.

```sh
npm install @pgcloud/sdk
```

```ts
import { Pgcloud } from '@pgcloud/sdk';

const pg = new Pgcloud({ token: process.env.PGCLOUD_TOKEN! });

const sizes = await pg.catalog.sizes();
const server = await pg.servers.create({ name: 'web-1', size: 's-1vcpu-1gb', image: 'ubuntu-24-04' });
const ready = await pg.servers.waitUntilActive(server.id);
console.log(`ssh root@${ready.networks.v4[0].ipAddress}`);

const deploy = await pg.deploys.create({ repoUrl: 'https://github.com/acme/app', branch: 'main', port: 3000 });
console.log((await pg.deploys.logs(deploy.id)).log);
```

Every write sends an `Idempotency-Key`, so retrying a call never creates two of anything. Errors are `PgcloudError` with `status`, `code`, `message` and `details`; `needsApproval` is true when a person has to approve the request in the console, and `pg.approvals.wait(id)` polls for the decision.

Types are generated from `packages/openapi/openapi.yaml` with `pnpm gen`; the client methods are written by hand so they read well. Regenerate after changing the spec, then run `pnpm test`.
