# Inspection Management

This module continues the uncommitted inspection foundation from the earlier HSE implementation. The earlier chat calls that foundation Stage 7 Part 1; the current conversation also refers to it as Stage 6 Part 3. The module name and existing schema are the source of truth.

## Setup

From `apps/api`, with the intended development database configured in `.env`:

```powershell
npx prisma validate --config prisma7.config.ts
npx prisma generate --config prisma7.config.ts
npx prisma migrate deploy --config prisma7.config.ts
$env:HSE_SEED_COMPANY_ID = '<active company UUID>'
npx tsx scripts/seed-inspection-management.ts
npm run build
```

The inspection migration is the existing `20260929174936_add_inspection_management`; this change does not introduce a replacement migration. Do not reset a database to install the module.

The seed creates eight permissions and four inspection types. It grants permissions to the existing active `SUPER_ADMIN` role only, following the existing seeds. Other roles need explicit grants and, except for `SUPER_ADMIN`, a site assignment. It does not invent operational checklist questions: configure those in **Inspection Management → Manage templates** before creating an inspection.

If there is exactly one active company, the company selector is optional. With multiple active companies, `HSE_SEED_COMPANY_ID` is required. The seed is transactional, serializes concurrent runs, and preserves existing type names, descriptions, categories and inactive status. A conflicting company-specific type name causes the whole seed to roll back.

From `apps/web`, run `npm run build` and start the usual development server. The new route is `/inspections`, inside the existing authenticated layout. The sidebar entry requires `inspections:read`.

## Workflow

`DRAFT → SCHEDULED → IN_PROGRESS → SUBMITTED → APPROVED → CLOSED`

A draft may also start directly. A submitted inspection may be rejected with a reason; `REJECTED → IN_PROGRESS` permits correction and resubmission.

- A new inspection requires an active type containing at least one active question, an active project and matching site, and an active inspector from the same company with site access (or the existing super-admin exception).
- The selected type, project, site and inspector remain fixed after creation. Title, description and scheduled date can change in draft, scheduled or rejected states.
- Checklist answers and new findings are allowed only while in progress. Mandatory answers are required at submission. `NOT_APPLICABLE` needs an explanation. Every `FAIL` answer needs a finding linked to that answer.
- Review requires `inspections:approve`; this existing permission covers approval and rejection. There is no new `reject` permission.
- Findings can close after approval, with a closure explanation and `inspections:close`. All findings must be closed before the inspection closes.
- Every successful mutation and workflow decision writes an audit record in the same transaction. Invalid operations roll back. Row locks serialize inspection edits and review decisions.
- Used template questions cannot be edited. Retire them and add replacements for future inspections. Existing checklists retain their original questions and mandatory flags, including after retirement.
- Company filtering applies to every inspection, even for super administrators. Other users additionally require site access. The form options endpoint avoids requiring unrelated user/project administration permissions.

## API and permissions

All routes below are under `/inspections` and use `JwtAuthGuard` followed by `PermissionsGuard`. IDs use UUID v4 validation. DTOs reject unknown fields and explicit null values.

| Method and route | Permission action |
| --- | --- |
| GET `/`, `/:id`, `/:id/history`, `/types`, `/options` | `read` |
| POST `/` | `create` |
| PATCH `/:id` | `update` |
| POST `/:id/schedule`, `/:id/start` | `update` |
| PATCH `/:id/checklist/:responseId` | `update` |
| POST `/:id/findings` | `manage-findings` |
| POST `/:id/submit` | `submit` |
| POST `/:id/approve`, `/:id/reject` | `approve` |
| POST `/:id/close`, `/:id/findings/:findingId/close` | `close` |
| POST `/types`, `/types/:typeId/items` | `manage-templates` |
| PATCH `/types/:typeId/items/:itemId` | `manage-templates` |
| POST `/types/:typeId/items/:itemId/retire` | `manage-templates` |

Approval/rejection and finding closure accept `{ "comments": "..." }`. Checklist responses accept `{ "result": "PASS|FAIL|NOT_APPLICABLE", "comments": "..." }`. Detail responses include checklist questions, answers and findings, selecting safe user fields only. History is read from `AuditLog` rather than a duplicate workflow history table.

## Verification

The new test suite uses a dedicated local database named **hse_inspections_test**. Never point it at development or production data. Apply migrations to that test database and start a separate API process with the same `DATABASE_URL` and an independent `JWT_SECRET` before running:

```powershell
$env:TEST_DATABASE_URL = '<local hse_inspections_test connection string>'
$env:TEST_API_URL = 'http://127.0.0.1:3107'
npm run test:inspections
```

The test command compiles the tests before running them, so `tsx` is not required for the test runner. The suite creates and removes its own company data. It upserts and retains the `SUPER_ADMIN` role and inspection permission definitions in the isolated test database. It must not run concurrently with other suites that share that database.

Verified: 15 inspection checks, 40 existing Stage 4/Stage 6 checks, the existing unit test, backend TypeScript/build, frontend build/lint, and a browser draft-to-closure smoke test. Existing suites retain their separate `hse_management_test` safety check.

## Remaining inspection work

Photo upload/storage (FR-033) remains deferred as in the earlier plan. There is no attachment endpoint or simulated upload. A reusable authorized storage design is still needed for permits, inspections and incident evidence. Corrective-action linkage, a dedicated equipment/vehicle registry, notifications, exports and mobile/offline functionality remain later work. Findings can currently be created and closed; editing an existing finding and richer template/type administration are not implemented in the UI.
