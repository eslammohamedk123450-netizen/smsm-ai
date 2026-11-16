# SULY — Comprehensive Test Master Plan (Compatibility Pointer)

**Canonical plan:** [SULY Unified 17-Phase Build & 17-Group Test Master Plan](DEVELOPMENT_ROADMAP_17_PHASES.md)

This file is retained only so existing links do not break. The complete Track B specification—17 test groups, entry/exit criteria, test statuses, evidence requirements, execution report template, and release acceptance rules—is now included in the same canonical document as Track A.

The two tracks are intentionally unified in one file:

- **Track A — Build & Development:** execute 17 phases sequentially on `develop`.
- **Track B — Comprehensive Testing:** execute 17 test groups after Track A is implementation-complete and integrated.

Routine focused developer/CI checks may run during Track A to prevent regressions; they do not count as completion of Track B. Any comprehensive-test failure returns to Track A as a scoped repair, followed by a documented retest.

Do not maintain a separate or conflicting Track B plan here. Update the canonical document on `develop` instead. Production remains protected and requires explicit owner approval.
