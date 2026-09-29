import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { hash } from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedInspectionManagement } from '../scripts/seed-inspection-management.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const apiUrl = process.env.TEST_API_URL ?? 'http://127.0.0.1:3107';
if (
  !databaseUrl ||
  new URL(databaseUrl).pathname !== '/hse_inspections_test' ||
  !['localhost', '127.0.0.1'].includes(new URL(databaseUrl).hostname) ||
  !['localhost', '127.0.0.1'].includes(new URL(apiUrl).hostname)
) {
  throw new Error(
    'Inspection tests require a local hse_inspections_test database and local API',
  );
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});
type Json = Record<string, any>;

async function request(
  path: string,
  token?: string,
  method = 'GET',
  body?: unknown,
) {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: (await response.json()) as Json };
}

test('Inspection management integration and security', async (t) => {
  const suffix = randomUUID();
  const password = randomUUID();
  let companyId = '';
  let foreignCompanyId = '';
  let roleId = '';
  let restrictedRoleId = '';
  let adminToken = '';
  let restrictedToken = '';
  let inspection: Json;
  try {
    const company = await prisma.company.create({
      data: { name: 'Inspection test company', code: `INSP-${suffix}` },
    });
    companyId = company.id;
    const role = await prisma.role.upsert({
      where: { name: 'SUPER_ADMIN' },
      update: {},
      create: { name: 'SUPER_ADMIN' },
    });
    roleId = role.id;
    const admin = await prisma.user.create({
      data: {
        companyId,
        roleId,
        username: `admin-${suffix}`,
        email: `admin-${suffix}@example.test`,
        passwordHash: await hash(password, 4),
      },
    });
    await t.test(
      'seed is repeatable and preserves customized inactive types',
      async () => {
        await seedInspectionManagement(prisma, companyId);
        const type = await prisma.inspectionType.findUniqueOrThrow({
          where: { companyId_code: { companyId, code: 'MIXER' } },
        });
        await prisma.inspectionType.update({
          where: { id: type.id },
          data: { name: 'Custom mixer', isActive: false },
        });
        await Promise.all([
          seedInspectionManagement(prisma, companyId),
          seedInspectionManagement(prisma, companyId),
        ]);
        assert.equal(
          await prisma.inspectionType.count({ where: { companyId } }),
          4,
        );
        assert.equal(
          await prisma.permission.count({ where: { module: 'inspections' } }),
          8,
        );
        assert.equal(
          await prisma.rolePermission.count({
            where: { roleId, permission: { module: 'inspections' } },
          }),
          8,
        );
        const reread = await prisma.inspectionType.findUniqueOrThrow({
          where: { id: type.id },
        });
        assert.equal(reread.name, 'Custom mixer');
        assert.equal(reread.isActive, false);
      },
    );
    const foreign = await prisma.company.create({
      data: { name: 'Foreign company', code: `FOREIGN-${suffix}` },
    });
    foreignCompanyId = foreign.id;
    await t.test(
      'seed refuses ambiguous or invalid company selection without partial writes',
      async () => {
        await assert.rejects(
          seedInspectionManagement(prisma),
          /HSE_SEED_COMPANY_ID/,
        );
        await assert.rejects(
          seedInspectionManagement(prisma, randomUUID()),
          /HSE_SEED_COMPANY_ID/,
        );
        assert.equal(
          await prisma.inspectionType.count({
            where: { companyId: foreignCompanyId },
          }),
          0,
        );
      },
    );
    await seedInspectionManagement(prisma, foreignCompanyId);
    await t.test(
      'seed rolls back earlier inserts when a later type conflicts',
      async () => {
        const collision = await prisma.company.create({
          data: { name: 'Seed rollback', code: `COLLISION-${suffix}` },
        });
        try {
          await prisma.inspectionType.create({
            data: {
              companyId: collision.id,
              name: 'Vehicle Inspection',
              code: 'CUSTOM',
              category: 'VEHICLE',
            },
          });
          await assert.rejects(seedInspectionManagement(prisma, collision.id));
          assert.equal(
            await prisma.inspectionType.count({
              where: { companyId: collision.id },
            }),
            1,
          );
          assert.equal(
            await prisma.inspectionType.count({
              where: { companyId: collision.id, code: 'SITE-GENERAL' },
            }),
            0,
          );
        } finally {
          await prisma.inspectionType.deleteMany({
            where: { companyId: collision.id },
          });
          await prisma.company.delete({ where: { id: collision.id } });
        }
      },
    );
    const project = await prisma.project.create({
      data: { companyId, name: 'Inspection project', code: suffix },
    });
    const site = await prisma.site.create({
      data: { projectId: project.id, name: 'Assigned site', code: 'ASSIGNED' },
    });
    const otherSite = await prisma.site.create({
      data: {
        projectId: project.id,
        name: 'Unassigned site',
        code: 'UNASSIGNED',
      },
    });
    const restrictedRole = await prisma.role.create({
      data: { name: `INSPECTOR-${suffix}` },
    });
    restrictedRoleId = restrictedRole.id;
    const allowed = await prisma.permission.findMany({
      where: {
        module: 'inspections',
        action: {
          in: ['read', 'create', 'update', 'submit', 'manage-findings'],
        },
      },
    });
    await prisma.rolePermission.createMany({
      data: allowed.map((permission) => ({
        roleId: restrictedRoleId,
        permissionId: permission.id,
      })),
    });
    const inspector = await prisma.user.create({
      data: {
        companyId,
        roleId: restrictedRoleId,
        username: `inspector-${suffix}`,
        email: `inspector-${suffix}@example.test`,
        passwordHash: await hash(password, 4),
        siteAccess: { create: { siteId: site.id } },
      },
    });
    adminToken = (
      await request('/auth/login', undefined, 'POST', {
        username: admin.username,
        password,
      })
    ).body.access_token;
    restrictedToken = (
      await request('/auth/login', undefined, 'POST', {
        username: inspector.username,
        password,
      })
    ).body.access_token;
    assert.ok(adminToken && restrictedToken);
    const type = await prisma.inspectionType.findUniqueOrThrow({
      where: { companyId_code: { companyId, code: 'SITE-GENERAL' } },
    });
    const foreignType = await prisma.inspectionType.findUniqueOrThrow({
      where: {
        companyId_code: { companyId: foreignCompanyId, code: 'SITE-GENERAL' },
      },
    });
    const payload = {
      title: 'Safety inspection',
      inspectionTypeId: type.id,
      projectId: project.id,
      siteId: site.id,
      inspectorId: inspector.id,
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    };
    await t.test(
      'authentication, permission and template boundaries',
      async () => {
        assert.equal((await request('/inspections')).status, 401);
        assert.equal(
          (
            await request('/inspections/types', restrictedToken, 'POST', {
              name: 'Blocked',
              code: 'BLOCKED',
              category: 'SITE',
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await request(
              `/inspections/types/${foreignType.id}/items`,
              adminToken,
              'POST',
              { itemText: 'Foreign item' },
            )
          ).status,
          404,
        );
        assert.equal(
          (await request('/inspections', adminToken, 'POST', payload)).status,
          400,
        );
        assert.equal(await prisma.inspection.count({ where: { project: { companyId } } }), 0);
      },
    );
    const item = (
      await request(`/inspections/types/${type.id}/items`, adminToken, 'POST', {
        itemText: 'Access route is clear',
        isMandatory: true,
      })
    ).body;
    assert.ok(item.id);
    await t.test(
      'DTO validation rejects null, blank, invalid IDs and injected fields',
      async () => {
        for (const extra of [
          { title: '   ' },
          { title: null },
          { description: null },
          { scheduledAt: null },
          { inspectorId: 'invalid' },
          { status: 'APPROVED' },
        ]) {
          assert.equal(
            (
              await request('/inspections', adminToken, 'POST', {
                ...payload,
                ...extra,
              })
            ).status,
            400,
          );
        }
      },
    );
    await t.test(
      'creation checks tenant, site, active inspector and template',
      async () => {
        assert.equal(
          (
            await request('/inspections', restrictedToken, 'POST', {
              ...payload,
              siteId: otherSite.id,
            })
          ).status,
          404,
        );
        assert.equal(
          (
            await request('/inspections', adminToken, 'POST', {
              ...payload,
              inspectionTypeId: foreignType.id,
            })
          ).status,
          404,
        );
        assert.equal(
          (
            await request('/inspections', adminToken, 'POST', {
              ...payload,
              inspectorId: randomUUID(),
            })
          ).status,
          400,
        );
        const response = await request(
          '/inspections',
          restrictedToken,
          'POST',
          payload,
        );
        assert.equal(response.status, 201, JSON.stringify(response.body));
        inspection = response.body;
        assert.match(inspection.inspectionNumber, /^INS-\d{4}-\d{6}$/);
        assert.equal(inspection.checklistResponses.length, 1);
        assert.equal(
          JSON.stringify(inspection).includes('passwordHash'),
          false,
        );
        const options = await request('/inspections/options', restrictedToken);
        assert.equal(options.status, 200);
        assert.deepEqual(
          options.body.sites.map((s: Json) => s.id),
          [site.id],
        );
      },
    );
    await t.test(
      'used templates are immutable and retirement preserves historical requirements',
      async () => {
        assert.equal(
          (
            await request(
              `/inspections/types/${type.id}/items/${item.id}`,
              adminToken,
              'PATCH',
              { itemText: 'Changed historical question' },
            )
          ).status,
          409,
        );
        assert.equal(
          (
            await request(
              `/inspections/types/${type.id}/items/${item.id}/retire`,
              adminToken,
              'POST',
            )
          ).status,
          200,
        );
        const updated = await request(
          `/inspections/${inspection.id}`,
          adminToken,
        );
        assert.equal(
          updated.body.checklistResponses[0].templateItem.itemText,
          'Access route is clear',
        );
      },
    );
    const id = () => inspection.id as string;
    const responseId = () => inspection.checklistResponses[0].id as string;
    await t.test(
      'workflow guards, mandatory answers, and failed-answer findings',
      async () => {
        assert.equal(
          (
            await request(
              `/inspections/${id()}/submit`,
              restrictedToken,
              'POST',
            )
          ).status,
          409,
        );
        assert.equal(
          (
            await request(
              `/inspections/${id()}/schedule`,
              restrictedToken,
              'POST',
            )
          ).status,
          200,
        );
        assert.equal(
          (await request(`/inspections/${id()}/start`, restrictedToken, 'POST'))
            .status,
          200,
        );
        assert.equal(
          (
            await request(
              `/inspections/${id()}/submit`,
              restrictedToken,
              'POST',
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await request(
              `/inspections/${id()}/checklist/${responseId()}`,
              restrictedToken,
              'PATCH',
              { result: 'NOT_APPLICABLE' },
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await request(
              `/inspections/${id()}/checklist/${randomUUID()}`,
              restrictedToken,
              'PATCH',
              { result: 'PASS' },
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await request(
              `/inspections/${id()}/checklist/${responseId()}`,
              restrictedToken,
              'PATCH',
              { result: 'FAIL', comments: 'Obstructed route' },
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await request(
              `/inspections/${id()}/submit`,
              restrictedToken,
              'POST',
            )
          ).status,
          400,
        );
        const finding = await request(
          `/inspections/${id()}/findings`,
          restrictedToken,
          'POST',
          {
            title: 'Obstructed route',
            description: 'Material blocks access',
            findingType: 'UNSAFE_CONDITION',
            severity: 'HIGH',
            checklistResponseId: responseId(),
          },
        );
        assert.equal(finding.status, 201);
        assert.equal(
          (
            await request(
              `/inspections/${id()}/submit`,
              restrictedToken,
              'POST',
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await request(
              `/inspections/${id()}/checklist/${responseId()}`,
              restrictedToken,
              'PATCH',
              { result: 'PASS' },
            )
          ).status,
          409,
        );
        assert.equal(
          (
            await request(
              `/inspections/${id()}/approve`,
              restrictedToken,
              'POST',
              {},
            )
          ).status,
          403,
        );
      },
    );
    await t.test(
      'concurrent creates have unique numbers and cross-inspection findings are rejected',
      async () => {
        await request(
          `/inspections/types/${type.id}/items`,
          adminToken,
          'POST',
          { itemText: 'New inspection question' },
        );
        const results = await Promise.all([
          request('/inspections', adminToken, 'POST', payload),
          request('/inspections', adminToken, 'POST', payload),
        ]);
        assert.deepEqual(
          results.map((result) => result.status),
          [201, 201],
        );
        assert.notEqual(
          results[0].body.inspectionNumber,
          results[1].body.inspectionNumber,
        );
        const other = results[0].body;
        await request(`/inspections/${other.id}/start`, adminToken, 'POST');
        const finding = await request(
          `/inspections/${other.id}/findings`,
          adminToken,
          'POST',
          {
            title: 'Cross inspection',
            description: 'Must be rejected',
            findingType: 'DEFECT',
            severity: 'LOW',
            checklistResponseId: responseId(),
          },
        );
        assert.equal(finding.status, 404);
        assert.equal(
          await prisma.inspectionFinding.count({
            where: { inspectionId: other.id },
          }),
          0,
        );
      },
    );
    await t.test(
      'rejection requires a reason and supports resubmission',
      async () => {
        assert.equal(
          (await request(`/inspections/${id()}/reject`, adminToken, 'POST', {}))
            .status,
          400,
        );
        assert.equal(
          (
            await request(`/inspections/${id()}/reject`, adminToken, 'POST', {
              comments: 'Please recheck',
            })
          ).status,
          200,
        );
        assert.equal(
          (await request(`/inspections/${id()}/start`, restrictedToken, 'POST'))
            .status,
          200,
        );
        assert.equal(
          (
            await request(
              `/inspections/${id()}/submit`,
              restrictedToken,
              'POST',
            )
          ).status,
          200,
        );
      },
    );
    await t.test(
      'concurrent review commits exactly one decision and one audit',
      async () => {
        const results = await Promise.all([
          request(`/inspections/${id()}/approve`, adminToken, 'POST', {
            comments: 'Reviewed',
          }),
          request(`/inspections/${id()}/approve`, adminToken, 'POST', {
            comments: 'Reviewed again',
          }),
        ]);
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
        assert.equal(
          await prisma.auditLog.count({
            where: { recordId: id(), module: 'inspections', action: 'APPROVE' },
          }),
          1,
        );
      },
    );
    await t.test(
      'findings must close before the inspection, and closed records stay immutable',
      async () => {
        assert.equal(
          (await request(`/inspections/${id()}/close`, adminToken, 'POST'))
            .status,
          409,
        );
        const finding = await prisma.inspectionFinding.findFirstOrThrow({
          where: { inspectionId: id() },
        });
        assert.equal(
          (
            await request(
              `/inspections/${id()}/findings/${finding.id}/close`,
              adminToken,
              'POST',
              {},
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await request(
              `/inspections/${id()}/findings/${finding.id}/close`,
              adminToken,
              'POST',
              { comments: 'Route cleared and verified' },
            )
          ).status,
          200,
        );
        assert.equal(
          (await request(`/inspections/${id()}/close`, adminToken, 'POST'))
            .status,
          200,
        );
        assert.equal(
          (
            await request(`/inspections/${id()}`, adminToken, 'PATCH', {
              title: 'Change closed record',
            })
          ).status,
          409,
        );
        const history = await request(
          `/inspections/${id()}/history`,
          adminToken,
        );
        assert.equal(history.status, 200);
        assert.ok(
          (history.body as unknown as Json[]).some(
            (event) => event.action === 'REJECT',
          ),
        );
        assert.ok(
          (history.body as unknown as Json[]).some(
            (event) =>
              event.action === 'FINDING_CLOSE' &&
              event.newValues.closureComments,
          ),
        );
      },
    );
    await t.test(
      'revoked site access hides list, detail, history and mutations',
      async () => {
        await prisma.userSiteAccess.deleteMany({
          where: { userId: inspector.id },
        });
        assert.deepEqual(
          (await request('/inspections', restrictedToken)).body,
          [],
        );
        assert.equal(
          (await request(`/inspections/${id()}`, restrictedToken)).status,
          404,
        );
        assert.equal(
          (await request(`/inspections/${id()}/history`, restrictedToken))
            .status,
          404,
        );
        assert.equal(
          (await request(`/inspections/${id()}/start`, restrictedToken, 'POST'))
            .status,
          404,
        );
      },
    );
    await t.test('company scope also applies to SUPER_ADMIN', async () => {
      const foreignAdmin = await prisma.user.create({
        data: {
          companyId: foreignCompanyId,
          roleId,
          username: `foreign-${suffix}`,
          email: `foreign-${suffix}@example.test`,
          passwordHash: await hash(password, 4),
        },
      });
      const token = (
        await request('/auth/login', undefined, 'POST', {
          username: foreignAdmin.username,
          password,
        })
      ).body.access_token;
      assert.equal((await request(`/inspections/${id()}`, token)).status, 404);
      assert.deepEqual((await request('/inspections', token)).body, []);
    });
  } finally {
    const companies = [companyId, foreignCompanyId].filter(Boolean);
    await prisma.inspection.deleteMany({
      where: { project: { companyId: { in: companies } } },
    });
    await prisma.inspectionType.deleteMany({
      where: { companyId: { in: companies } },
    });
    await prisma.auditLog.deleteMany({
      where: { companyId: { in: companies } },
    });
    await prisma.userSiteAccess.deleteMany({
      where: { user: { companyId: { in: companies } } },
    });
    await prisma.user.deleteMany({ where: { companyId: { in: companies } } });
    await prisma.site.deleteMany({
      where: { project: { companyId: { in: companies } } },
    });
    await prisma.project.deleteMany({
      where: { companyId: { in: companies } },
    });
    await prisma.company.deleteMany({ where: { id: { in: companies } } });
    if (restrictedRoleId) {
      await prisma.rolePermission.deleteMany({
        where: { roleId: restrictedRoleId },
      });
      await prisma.role.delete({ where: { id: restrictedRoleId } });
    }
    await prisma.$disconnect();
  }
});
