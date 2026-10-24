# ADR-063: Supplier price feeds, live stock and online ordering

- Status: Deferred (needs a non-free supplier service and a change to ADR-002; the user chooses the supplier)
- Date: 2026-10-24
- Decided by: user, 2026-10-24: "create the ADRs … auto-accept the recommended suggestion" (answers below)
- Depends on: ADR-002, ADR-062
- Design: n/a
- Backlog: N58

## Context

The research behind _Live price/cost estimate_ (rank 24) and _Consumer order completeness_ cites commercial
systems with **live pricing data and ordering** (Cyncly, Roomle Rubens from €650/month, VividWorks, pCon). Getting
prices, stock or orders from board suppliers (Egger, Kronospan, Kastamonu, Fundermax dealers, cutting services)
needs at least one of: a supplier API with an account or contract, a paid catalog-data subscription, or a server to
hold keys and relay requests. ADR-002 forbids backends, accounts, cloud and remote services. This is the
"non-free services or similar integrations" case the user asked to keep pending.

## Decision

- Nothing in this ADR is built while ADR-002 stands. ADR-062 (user's own price list) and ADR-064 (shopping list
  file) cover the need offline.
- Recommended answers are recorded below so the decision is ready if the user approves a service; the questions that
  need the user's own facts (which supplier, which contract, cost) are open and keep this ADR **Deferred**.

## Alternatives considered

- **Scrape supplier web shops from the browser** — breaks their terms, fails offline, and CORS blocks it.
- **Hard-code a price table** — invented data (ADR-010) and out of date at once.

## Scope

- In scope: recording the decision not to integrate now.
- Out of scope: any supplier integration while ADR-002 stands.

## Consequences

- Prices stay user-entered; ordering stays a file the user sends (ADR-064).

## Open questions

1. _Integrate a supplier price feed now?_ — **Recommended and accepted: no; keep ADR-062's own price list.**
2. _Send orders online?_ — **Recommended and accepted: no; export the shopping list (ADR-064).**
3. _Which supplier or cutting service, under which contract and monthly cost?_ — **Open: only the user can answer;
   it also needs ADR-002 to be changed by the user.**
4. _Is a backend acceptable for holding supplier keys?_ — **Open: would supersede ADR-002.**
