---
name: Orval Zod compatibility
description: The generated API validation code must target the workspace's installed Zod major version.
---

Orval can emit Zod 4-only helpers such as `zod.int()` even when the workspace resolves Zod 3; configure its Zod output version explicitly to match the catalog dependency.

**Why:** Code generation can succeed while the library typecheck fails if the generated syntax targets a different Zod major version.

**How to apply:** When changing the API spec or regenerating clients, keep the Orval Zod version aligned with the workspace catalog and run the library typecheck immediately after codegen.