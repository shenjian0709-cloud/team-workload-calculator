# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2026-09-22

### Added

- Member create/edit/archive/restore, four-team management (INFR / ADI / SMO / TO).
- Explicit weekly records, available hours, capacity utilization, notes, validated ISO weeks and optimistic concurrency.
- Database-backed 12-week trends, missing-report states and calendar-contiguous high-load alerts.
- Shared-password production access, same-origin writes, security headers and login throttling.
- Responsive interface with locally rendered charts; no runtime CDN dependencies.
- Idempotent v1.3 migration preserving source data and historical model scores.
- Node/API/migration tests and GitHub CI including Docker smoke checks.
- Offline deployment package instructions, backup and rollback procedures.

### Changed

- Planner task quantity is now Task, limited to independent work to avoid project double-counting.
- Context factor is 1 / 1.05 / 1.1 for up to 2 / 3 / 4 active operations categories.
- Capacity scales with weekly availability; scores remain explicitly estimated, not actual hours.
- Node built-in SQLite replaces sqlite3; production uses Node 24 with a non-root container and database health endpoint.
- Removed legacy entrypoint files; old HTML URLs redirect to the new homepage.

### Migration notes

- Legacy teams become unassigned for manual reassignment; historical team snapshots remain unchanged.
- Undated legacy member counts remain in the original table and are not assumed to belong to the current week.
- Back up the entire database directory before upgrading. Production now requires ADMIN_PASSWORD (12+ characters).

## [1.3.0] - 2026-04-16

### Changed

- Replaced the legacy slider scoring flow with the V3 ITIL operations plus project workload model
- Expanded member records and API payloads to include `inc_count`, `req_count`, `chg_count`, `prb_count`, `active_projects`, and `planner_tasks`
- Added schema compatibility logic to backfill missing columns and normalize legacy `SYSTEM OPERATION` group values to `INFR`
- Introduced capability and work-pattern matching in the V3 editor and recalculated total load as `(Ops Score x ContextFactor + Project Score) x CFC`
- Tuned workload weights and matching factors for the new task-based assessment model
- Fixed remaining V3 page text corruption issues by moving the frontend logic into `public/app.v3.js` and restoring user-visible Chinese copy
- Kept the active application entrypoints on `public/index.v3.html` and `server.v2fixed.js`

## [1.2.0] - 2026-04-13

### Changed

- Restored interactive member editing workflow in V2
- Added member create and update APIs for the dashboard
- Reintroduced slider-based workload controls and inline metric guidance
- Adjusted workload status thresholds to the new five-level model
- Updated app startup to use the fixed V2 server entry
- Removed legacy entry files and outdated V1 artifacts from the workspace

## [1.0.0] - 2026-04-10

### Added

- Multi-member workload assessment page
- Configurable weighted metrics and CFC-based scoring
- Member dashboard, team dashboard, and analysis recommendations
- Snapshot history and JSON export
- Docker deployment files (`Dockerfile`, `docker-compose.yml`, `nginx.conf`)
- Project documentation (`README.md`) and git ignore rules
