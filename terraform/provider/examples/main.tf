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

output "address" {
  value = pgcloud_server.web.ipv4_address
}
