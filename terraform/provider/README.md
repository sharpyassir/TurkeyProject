# terraform-provider-pgcloud

Manage pgcloud from Terraform or OpenTofu. Built on terraform-plugin-framework and the public API.

| Kind | Name | Notes |
|---|---|---|
| resource | `pgcloud_server` | create waits until active; `size` changes resize in place; image, region, project, user_data and name replace |
| resource | `pgcloud_volume` | block storage; `size_gb` grows in place, `server_id` attaches, detaches or moves it |
| resource | `pgcloud_load_balancer` | managed HAProxy; `forwarding_rule` blocks, `server_ids` or `tag` targets |
| resource | `pgcloud_domain` | hosted zone; `nameservers` output for the registrar |
| resource | `pgcloud_dns_record` | one record; `name` relative to the zone |
| resource | `pgcloud_bucket` | S3 compatible bucket; `public` toggles anonymous read |
| resource | `pgcloud_storage_key` | S3 access key pair, secret in state |
| resource | `pgcloud_firewall` | rules as `rule` blocks; a rule change replaces the firewall |
| resource | `pgcloud_ssh_key` | public key on the account |
| data | `pgcloud_sizes` | sizes with vCPU, memory, disk and transfer |
| data | `pgcloud_images` | distribution images and marketplace apps, filter with `kind` |

See `examples/main.tf`. The provider reads `PGCLOUD_TOKEN` and `PGCLOUD_API_URL` when the block leaves them out.

## Local build

```sh
go build -o terraform-provider-pgcloud .
cat > ~/.terraformrc <<'EOF2'
provider_installation {
  dev_overrides { "pgcloud/pgcloud" = "/path/to/terraform/provider" }
  direct {}
}
EOF2
cd examples && terraform plan
```

Every write sends an `Idempotency-Key`. When the token requires approval for a delete, `terraform destroy` stops with the approval message; approve it in the console and run destroy again.

## What is here and what is not

Here: the provider, three resources, two data sources, import for every resource, client tests. Not yet: registry publishing (needs a signing key and the release workflow), acceptance tests against a live API, and resources for deployments, snapshots and tokens. The CLI and the API cover those today.
