---
name: Browser verification
description: Runtime validation expectations for the NHLsnipes web artifact.
---

Verify the running preview after frontend changes, not only the TypeScript check and production build.

**Why:** The frontend passed static checks while the first preview failed at runtime with a hook error, and a later data-shape issue only became obvious in the browser.

**How to apply:** After a meaningful UI change, restart the web workflow once, capture desktop and mobile previews, and inspect browser console output for runtime errors before presenting the artifact.