terraform {
  required_providers {
    pgcloud = { source = "pgcloud/pgcloud" }
  }
}

# Token from PGCLOUD_TOKEN; api_url from PGCLOUD_API_URL.
provider "pgcloud" {}

data "pgcloud_sizes" "all" {}

resource "pgcloud_ssh_key" "me" {
  name       = "laptop"
  public_key = file("~/.ssh/id_ed25519.pub")
}

resource "pgcloud_firewall" "web" {
  name = "web"
  rule { direction = "inbound"  protocol = "tcp" ports = "22"     cidrs = ["203.0.113.0/24"] }
  rule { direction = "inbound"  protocol = "tcp" ports = "80-443" cidrs = ["0.0.0.0/0", "::/0"] }
  rule { direction = "outbound" protocol = "any"                  cidrs = ["0.0.0.0/0"] }
}

resource "pgcloud_server" "web" {
  name      = "web-1"
  size      = "s-1vcpu-1gb"
  image     = "ubuntu-24-04"
  ssh_keys  = [pgcloud_ssh_key.me.id]
  firewalls = [pgcloud_firewall.web.id]
  tags      = ["terraform"]
  user_data = <<-EOT
    #cloud-config
    packages: [nginx]
  EOT
}

resource "pgcloud_volume" "data" {
  name      = "web-data"
  size_gb   = 100
  server_id = pgcloud_server.web.id
}

resource "pgcloud_load_balancer" "web" {
  name       = "web"
  nodes      = 2
  server_ids = [pgcloud_server.web.id]

  forwarding_rule {
    entry_protocol  = "http"
    entry_port      = 80
    target_protocol = "http"
    target_port     = 80
  }
}

resource "pgcloud_domain" "site" {
  name = "example.com"
}

resource "pgcloud_dns_record" "apex" {
  domain = pgcloud_domain.site.name
  name   = "@"
  type   = "A"
  value  = pgcloud_load_balancer.web.ip
}

resource "pgcloud_dns_record" "www" {
  domain = pgcloud_domain.site.name
  name   = "www"
  type   = "CNAME"
  value  = "example.com"
}

output "address" {
  value = pgcloud_server.web.ipv4_address
}
