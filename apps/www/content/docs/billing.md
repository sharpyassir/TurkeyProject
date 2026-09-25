---
title: Billing and pricing
description: Hourly billing, monthly caps, dollars or lira, and what happens when credit runs out.
section: Guides
order: 11
---

## How you are charged

Every resource is metered by the hour it exists and capped at its monthly price. A server that lives a whole month costs its monthly price and never more. One that lives three hours costs three hours. Stopping a server does not stop billing, because its disk and address are still yours. Delete it, or take a snapshot and delete it, to stop the meter.

The monthly price divided by 672 gives the hourly rate. There is no minimum term.

## Dollars or lira

Prices are set in US dollars. If your team's currency is Turkish lira, every price you see and every invoice is converted at the exchange rate stored at that hour, and the rate is shown next to the price. Dollar prices stay stable; the lira figures move with the rate.

## Credit and invoices

New accounts start with credit. Usage is drawn from credit first. On the first of each month an invoice is issued for the previous month, with an e-Fatura for Turkish companies. Add credit or a card under **Billing** before the credit runs out; the console shows month to date spend and the projected total.

## Spending caps

Each project can have a monthly limit, and each agent token can have its own cap. A create or resize that would go past the cap is refused with `spend_limit_reached` before anything is charged. Caps reset on the first of the month.

## What costs what

| Resource | Billed |
|---|---|
| Server | per hour, capped at the monthly price of its size |
| Public IPv4 | per hour with the server; reserved IPs also while unattached |
| Snapshot | per GB per month |
| Backups | 20 percent of the server price, when enabled |
| One click app | the server price plus the app's price, if any |
| Bandwidth | included allowance per size, then per TB |

The live price list is at `GET /v1/pricing` and in `pgcloud sizes`.
