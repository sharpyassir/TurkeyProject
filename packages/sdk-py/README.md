# pgcloud (Python)

```sh
pip install pgcloud
```

```python
import os
from pgcloud import Pgcloud, PgcloudError

pg = Pgcloud(token=os.environ["PGCLOUD_TOKEN"])
server = pg.servers.create(name="web-1", size="s-1vcpu-1gb", image="ubuntu-24-04")
server = pg.servers.wait_until_active(server["id"])
print("ssh root@" + server["networks"]["v4"][0]["ipAddress"])

try:
    pg.servers.delete(server["id"])
except PgcloudError as e:
    if e.needs_approval:
        print("waiting for a person:", pg.approvals.wait(e.details["approvalId"])["status"])
```

No dependencies. Every write sends an `Idempotency-Key`. Responses are plain dicts shaped like the API reference. Run `python -m unittest` in this folder to test.
