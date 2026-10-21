# Change control

Triggers: a new user instruction that conflicts with an ADR; any change to `types.ts`, the design document,
`FurnitureModel`, Dexie schema, gap arithmetic, or the network boundary.

1. Quote the ADR sentence and the proposed change.
2. Authority: explicit user decision › Accepted ADR › code + tests › history › proposal.
3. `architecture-authority` writes a new ADR (old one → Superseded, linked) or amends it with a new date.
4. `storage` can veto anything that deletes or rewrites saved designs; `furniture-geometry` can veto invented
   physical facts. Only a new explicit user decision lifts a veto.
5. Update the ADR index, run `scripts/validate.py`.
