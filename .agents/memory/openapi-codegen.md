---
name: OpenAPI request body schemas
description: Prevent generated Zod and TypeScript request-body export conflicts.
---

Every OpenAPI request body should `$ref` a distinct entity-shaped schema in `components/schemas`; do not leave bodies inline or name the component after the operation. Orval emits operation-derived Zod body schemas and updates the `api-zod` barrel, so inline request types can collide with those generated exports.

**Why:** Re-running code generation after adding inline request bodies caused duplicate TypeScript exports and failed the library typecheck.

**How to apply:** Before regenerating, confirm each request body references a separate named component, then run the workspace's API codegen command and typecheck.
