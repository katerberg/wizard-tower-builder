---
globs: src/model/blueprints.ts, src/store/librarySections.ts,
  src/store/selectors/build.ts, src/store/handlers/build.ts,
  src/model/construction/orders.ts
description: When adding a new room blueprint that needs to appear in the build
  library and register as a storage site, all 5 connection points must be
  updated.
---

When adding a room that acts as a storage site (stockpiles stone/metal), all 5 wires must be connected: (1) add to STARTING_BLUEPRINT_IDS or research tree, (2) map in BLUEPRINT_LIBRARY_SECTION, (3) don't filter in toLibraryItem(), (4) don't block in placeSelected(), (5) pre-assign targetId in createBuildOrder() and registerStorageSite in completeConstructionOrder().