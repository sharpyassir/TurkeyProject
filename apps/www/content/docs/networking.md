---
title: Firewalls and addresses
description: Host enforced firewall rules, public and private addresses, reserved IPs and reverse DNS.
section: Guides
order: 13
---

## Firewalls

A firewall is a named list of rules you attach to any number of servers. Rules are enforced on the host, outside the server, so a compromised server cannot loosen them.

Create one under **Security, Firewalls**: for each rule choose the direction, protocol, port or range, and the sources or destinations as CIDR blocks. A typical web server allows inbound TCP 22 from your office and 80 and 443 from anywhere, and everything outbound.

Attach it from the firewall page or from the server's **Networking** tab. Changes apply within seconds to every attached server. A server with no firewall accepts everything.

From the terminal, `pgcloud firewalls` lists them; creating and attaching is done in the console or through the API (`POST /v1/firewalls`, `POST /v1/firewalls/{id}/servers`).

## Addresses

Every server gets one public IPv4 address and one private address on your team's private network. Traffic between your servers over private addresses is free and never leaves the data center.

## Reserved IPs

A reserved IP belongs to your team rather than to a server. Move it between servers to switch traffic without changing DNS. Reserved IPs cost the same as a server address while attached and a small hourly fee while parked.

## Reverse DNS

Set the reverse record for any of your addresses under **Core Cloud, Public IPs**. Mail servers need this to be accepted by other providers.
