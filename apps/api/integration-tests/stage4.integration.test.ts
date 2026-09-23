import { test } from 'node:test';
import assert from 'node:assert/strict';

import dotenv from 'dotenv';

import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

// ==========================================
// 1. LOAD TEST CONFIGURATION
// ==========================================

dotenv.config({
  path: '.env.integration.local',
});

const databaseUrl = process.env.TEST_DATABASE_URL;

const apiUrl =
  process.env.TEST_API_URL ??
  'http://127.0.0.1:3000';

const username =
  process.env.TEST_ADMIN_USERNAME ??
  'hse_admin';

const password = process.env.TEST_ADMIN_PASSWORD;

if (!databaseUrl || !password) {
  throw new Error(
    'Missing TEST_DATABASE_URL or TEST_ADMIN_PASSWORD',
  );
}

// ==========================================
// 2. DATABASE SAFETY CHECK
// ==========================================

const parsedDatabaseUrl = new URL(databaseUrl);

const databaseName = decodeURIComponent(
  parsedDatabaseUrl.pathname.slice(1),
);

if (databaseName !== 'hse_management_test') {
  throw new Error(
    `Refusing to run tests against database: ${databaseName}`,
  );
}

// The API must also be a local development server.
const parsedApiUrl = new URL(apiUrl);

if (
  parsedApiUrl.hostname !== '127.0.0.1' &&
  parsedApiUrl.hostname !== 'localhost'
) {
  throw new Error(
    'Integration tests must target a local API server',
  );
}

// ==========================================
// 3. PRISMA CLIENT
// ==========================================

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl,
  }),
});

// ==========================================
// 4. TEST IDENTIFIERS
// ==========================================

const runId = [
  Date.now(),
  Math.floor(Math.random() * 100000),
].join('');

function code(prefix: string): string {
  return `${prefix}-${runId}`;
}

let token = '';

let adminId = '';

let adminCompanyId = '';

let originalAdminActive = true;

let originalAdminRoleId = '';

// Track only records created by this test run.
const created = {
  companies: [] as string[],
  departments: [] as string[],
  projects: [] as string[],
  sites: [] as string[],
  employees: [] as string[],
};

// ==========================================
// 5. RESPONSE TYPES
// ==========================================

interface ApiResponse {
  status: number;
  data: unknown;
}

interface IdRecord {
  id: string;
}

// ==========================================
// 6. HTTP REQUEST HELPER
// ==========================================

async function api(
  method: string,
  path: string,
  body?: unknown,
  authenticated = true,
): Promise<ApiResponse> {
  const response = await fetch(
    `${apiUrl}${path}`,
    {
      method,

      headers: {
        ...(body !== undefined && {
          'Content-Type': 'application/json',
        }),

        ...(authenticated && token && {
          Authorization: `Bearer ${token}`,
        }),
      },

      ...(body !== undefined && {
        body: JSON.stringify(body),
      }),
    },
  );

  const responseText = await response.text();

  let data: unknown = null;

  if (responseText) {
    try {
      data = JSON.parse(responseText) as unknown;
    } catch {
      data = responseText;
    }
  }

  return {
    status: response.status,
    data,
  };
}

// ==========================================
// 7. RESPONSE VALIDATION HELPERS
// ==========================================

// Fixes the TypeScript errors involving
// accessing properties on unknown values.

function responseObject(
  value: unknown,
): Record<string, unknown> {
  assert.ok(
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value),
    'Expected an object response',
  );

  return value as Record<string, unknown>;
}

function responseArray(
  value: unknown,
): IdRecord[] {
  assert.ok(
    Array.isArray(value),
    'Expected an array response',
  );

  for (const item of value) {
    assert.ok(
      item !== null &&
      typeof item === 'object' &&
      typeof (item as IdRecord).id === 'string',
      'Expected every array item to contain an ID',
    );
  }

  return value as IdRecord[];
}

function record(
  collection: string[],
  value: unknown,
): string {
  assert.equal(
    typeof value,
    'string',
    'Expected a generated UUID',
  );

  const id = value as string;

  collection.push(id);

  return id;
}

function getId(
  response: ApiResponse,
): string {
  const data = responseObject(response.data);

  assert.equal(
    typeof data.id,
    'string',
    'Response does not contain a valid ID',
  );

  return data.id as string;
}

// ==========================================
// 8. MAIN INTEGRATION TEST SUITE
// ==========================================

test(
  'Stage 4 integration and security suite',
  {
    timeout: 180_000,
  },

  async (t) => {
    let foreignCompanyId = '';

    let foreignDepartmentId = '';
    let foreignProjectId = '';
    let foreignSiteId = '';
    let foreignEmployeeId = '';

    let localDepartmentId = '';
    let localProjectId = '';
    let localSiteId = '';

    try {
      // ==================================
      // SETUP: VERIFY ADMINISTRATOR
      // ==================================

      const admin = await prisma.user.findUnique({
        where: {
          username,
        },
      });

      assert.ok(
        admin,
        'Test administrator was not found',
      );

      adminId = admin.id;

      adminCompanyId = admin.companyId;

      originalAdminActive = admin.isActive;

      originalAdminRoleId = admin.roleId;

      assert.equal(
        originalAdminActive,
        true,
        'Test administrator must initially be active',
      );

      // ==================================
      // SETUP: LOGIN
      // ==================================

      const login = await api(
        'POST',
        '/auth/login',
        {
          username,
          password,
        },
        false,
      );

      assert.equal(
        login.status,
        200,
        'Administrator login failed',
      );

      const loginData = responseObject(login.data);

      assert.equal(
        typeof loginData.access_token,
        'string',
        'Login response does not contain an access token',
      );

      token = loginData.access_token as string;

      // ==================================
      // SETUP: FOREIGN COMPANY
      // ==================================

      const foreignCompany =
        await prisma.company.create({
          data: {
            name: `Integration Company ${runId}`,
            code: code('ITCOMP'),
          },
        });

      foreignCompanyId = record(
        created.companies,
        foreignCompany.id,
      );

      // ==================================
      // SETUP: FOREIGN DEPARTMENT
      // ==================================

      const foreignDepartment =
        await prisma.department.create({
          data: {
            companyId: foreignCompanyId,
            name: `Foreign Department ${runId}`,
          },
        });

      foreignDepartmentId = record(
        created.departments,
        foreignDepartment.id,
      );

      // ==================================
      // SETUP: FOREIGN PROJECT
      // ==================================

      const foreignProject =
        await prisma.project.create({
          data: {
            companyId: foreignCompanyId,
            name: `Foreign Project ${runId}`,
            code: code('FPRJ'),
          },
        });

      foreignProjectId = record(
        created.projects,
        foreignProject.id,
      );

      // ==================================
      // SETUP: FOREIGN SITE
      // ==================================

      const foreignSite =
        await prisma.site.create({
          data: {
            projectId: foreignProjectId,
            name: `Foreign Site ${runId}`,
            code: code('FSITE'),
          },
        });

      foreignSiteId = record(
        created.sites,
        foreignSite.id,
      );

      // ==================================
      // SETUP: FOREIGN EMPLOYEE
      // ==================================

      const foreignEmployee =
        await prisma.employee.create({
          data: {
            companyId: foreignCompanyId,
            departmentId: foreignDepartmentId,

            employeeNumber: code('FEMP'),

            fullName: 'Foreign Test Employee',
          },
        });

      foreignEmployeeId = record(
        created.employees,
        foreignEmployee.id,
      );

      // ==================================
      // SETUP: LOCAL DEPARTMENT
      // ==================================

      const localDepartment =
        await prisma.department.create({
          data: {
            companyId: adminCompanyId,
            name: `Local Department ${runId}`,
          },
        });

      localDepartmentId = record(
        created.departments,
        localDepartment.id,
      );

      // ==================================
      // SETUP: LOCAL PROJECT
      // ==================================

      const localProject =
        await prisma.project.create({
          data: {
            companyId: adminCompanyId,
            name: `Local Project ${runId}`,
            code: code('LPRJ'),
          },
        });

      localProjectId = record(
        created.projects,
        localProject.id,
      );

      // ==================================
      // SETUP: LOCAL SITE
      // ==================================

      const localSite =
        await prisma.site.create({
          data: {
            projectId: localProjectId,
            name: `Local Site ${runId}`,
            code: code('LSITE'),
          },
        });

      localSiteId = record(
        created.sites,
        localSite.id,
      );

      // ==================================
      // SAFETY: API DATABASE MATCH
      // ==================================

      const projectList = await api(
        'GET',
        '/projects',
      );

      assert.equal(
        projectList.status,
        200,
        'Project list request failed',
      );

      const initialProjects = responseArray(
        projectList.data,
      );

      assert.ok(
        initialProjects.some(
          (item) => item.id === localProjectId,
        ),
        'API and test runner are not connected to the same database',
      );

      // ==================================
      // TEST 1: AUTHENTICATION
      // ==================================

      await t.test(
        'Protected endpoint rejects missing token',

        async () => {
          const response = await api(
            'GET',
            '/employees',
            undefined,
            false,
          );

          assert.equal(
            response.status,
            401,
          );
        },
      );

      // ==================================
      // TEST 2: TENANT ISOLATION - READS
      // ==================================

      await t.test(
        'Company-scoped lists exclude foreign records',

        async () => {
          const [
            departments,
            projects,
            sites,
            employees,
          ] = await Promise.all([
            api('GET', '/departments'),
            api('GET', '/projects'),
            api('GET', '/sites'),
            api('GET', '/employees'),
          ]);

          for (const response of [
            departments,
            projects,
            sites,
            employees,
          ]) {
            assert.equal(
              response.status,
              200,
            );
          }

          const departmentRows = responseArray(
            departments.data,
          );

          const projectRows = responseArray(
            projects.data,
          );

          const siteRows = responseArray(
            sites.data,
          );

          const employeeRows = responseArray(
            employees.data,
          );

          assert.ok(
            !departmentRows.some(
              (item) =>
                item.id === foreignDepartmentId,
            ),
            'Foreign department was exposed',
          );

          assert.ok(
            !projectRows.some(
              (item) =>
                item.id === foreignProjectId,
            ),
            'Foreign project was exposed',
          );

          assert.ok(
            !siteRows.some(
              (item) =>
                item.id === foreignSiteId,
            ),
            'Foreign site was exposed',
          );

          assert.ok(
            !employeeRows.some(
              (item) =>
                item.id === foreignEmployeeId,
            ),
            'Foreign employee was exposed',
          );
        },
      );

      // ==================================
      // TEST 3: TENANT ISOLATION - WRITES
      // ==================================

      await t.test(
        'Cross-company mutations are rejected',

        async () => {
          const requests = [
            api(
              'PATCH',
              `/departments/${foreignDepartmentId}`,
              {
                name: 'Unauthorized Department Edit',
              },
            ),

            api(
              'PATCH',
              `/projects/${foreignProjectId}`,
              {
                name: 'Unauthorized Project Edit',
              },
            ),

            api(
              'PATCH',
              `/sites/${foreignSiteId}`,
              {
                name: 'Unauthorized Site Edit',
              },
            ),

            api(
              'PATCH',
              `/employees/${foreignEmployeeId}`,
              {
                fullName: 'Unauthorized Employee Edit',
              },
            ),

            api(
              'POST',
              '/sites',
              {
                projectId: foreignProjectId,
                name: 'Unauthorized Site',
                code: code('BAD-SITE'),
              },
            ),

            api(
              'POST',
              '/employees',
              {
                employeeNumber: code('BAD-EMP'),
                fullName: 'Unauthorized Employee',
                departmentId: foreignDepartmentId,
              },
            ),
          ];

          const responses = await Promise.all(
            requests,
          );

          const expectedStatuses = [
            404,
            404,
            404,
            404,
            404,
            400,
          ];

          responses.forEach(
            (response, index) => {
              assert.equal(
                response.status,
                expectedStatuses[index],
                `Cross-company request ${index + 1} was not blocked`,
              );
            },
          );

          // Verify no foreign record changed.

          const department =
            await prisma.department.findUniqueOrThrow({
              where: {
                id: foreignDepartmentId,
              },
            });

          assert.equal(
            department.name,
            `Foreign Department ${runId}`,
          );

          const project =
            await prisma.project.findUniqueOrThrow({
              where: {
                id: foreignProjectId,
              },
            });

          assert.equal(
            project.name,
            `Foreign Project ${runId}`,
          );

          const site =
            await prisma.site.findUniqueOrThrow({
              where: {
                id: foreignSiteId,
              },
            });

          assert.equal(
            site.name,
            `Foreign Site ${runId}`,
          );

          const employee =
            await prisma.employee.findUniqueOrThrow({
              where: {
                id: foreignEmployeeId,
              },
            });

          assert.equal(
            employee.fullName,
            'Foreign Test Employee',
          );
        },
      );

      // ==================================
      // TEST 4: FOREIGN SITE ASSIGNMENT
      // ==================================

      await t.test(
        'Site assignment cannot target a foreign site',

        async () => {
          const response = await api(
            'POST',
            `/sites/${foreignSiteId}/access`,
            {
              userId: adminId,
            },
          );

          assert.equal(
            response.status,
            404,
          );

          const assignment =
            await prisma.userSiteAccess.findFirst({
              where: {
                siteId: foreignSiteId,
                userId: adminId,
              },
            });

          assert.equal(
            assignment,
            null,
          );
        },
      );

      // ==================================
      // TEST 5: SITE ASSIGNMENT
      // ==================================

      await t.test(
        'Site assignment is idempotent and removable',

        async () => {
          const first = await api(
            'POST',
            `/sites/${localSiteId}/access`,
            {
              userId: adminId,
            },
          );

          assert.equal(
            first.status,
            201,
          );

          const second = await api(
            'POST',
            `/sites/${localSiteId}/access`,
            {
              userId: adminId,
            },
          );

          assert.equal(
            second.status,
            201,
          );

          const count =
            await prisma.userSiteAccess.count({
              where: {
                siteId: localSiteId,
                userId: adminId,
              },
            });

          assert.equal(
            count,
            1,
            'Duplicate site assignment was created',
          );

          const remove = await api(
            'DELETE',
            `/sites/${localSiteId}/access/${adminId}`,
          );

          assert.equal(
            remove.status,
            200,
          );

          const remaining =
            await prisma.userSiteAccess.count({
              where: {
                siteId: localSiteId,
                userId: adminId,
              },
            });

          assert.equal(
            remaining,
            0,
          );
        },
      );

      // ==================================
      // TEST 6: INVALID PROJECT DATES
      // ==================================

      await t.test(
        'Invalid project dates are rejected',

        async () => {
          const result = await api(
            'POST',
            '/projects',
            {
              name: 'Invalid Date Test',
              code: code('BAD-DATE'),
              startDate: '2026-12-31',
              endDate: '2026-01-01',
            },
          );

          assert.equal(
            result.status,
            400,
          );
        },
      );

      // ==================================
      // TEST 7: UNEXPECTED FIELDS
      // ==================================

      await t.test(
        'Unexpected employee fields are rejected',

        async () => {
          const result = await api(
            'POST',
            '/employees',
            {
              employeeNumber: code('BAD-FIELD'),
              fullName: 'Invalid Field Test',
              companyId: foreignCompanyId,
            },
          );

          assert.equal(
            result.status,
            400,
          );
        },
      );

      // ==================================
      // TEST 8: CONCURRENT DUPLICATES
      // ==================================

      await t.test(
        'Concurrent duplicate project creation',

        async () => {
          const projectCode = code(
            'RACE-PROJECT',
          );

          const payload = {
            name: 'Concurrent Project Test',
            code: projectCode,
          };

          const results = await Promise.all([
            api('POST', '/projects', payload),
            api('POST', '/projects', payload),
          ]);

          const statuses = results
            .map((result) => result.status)
            .sort((a, b) => a - b);

          assert.deepEqual(
            statuses,
            [201, 409],
          );

          const rows =
            await prisma.project.findMany({
              where: {
                companyId: adminCompanyId,
                code: projectCode,
              },
            });

          assert.equal(
            rows.length,
            1,
            'Concurrent requests created duplicate projects',
          );

          record(
            created.projects,
            rows[0].id,
          );
        },
      );

      // ==================================
      // TEST 9: AUDIT LOGGING
      // ==================================

      await t.test(
        'Successful mutations produce audit records',

        async () => {
          const employeeNumber = code(
            'AUDIT-EMP',
          );

          const create = await api(
            'POST',
            '/employees',
            {
              employeeNumber,
              fullName: 'Audit Test Employee',
              departmentId: localDepartmentId,
            },
          );

          assert.equal(
            create.status,
            201,
          );

          const employeeId = record(
            created.employees,
            getId(create),
          );

          const update = await api(
            'PATCH',
            `/employees/${employeeId}`,
            {
              fullName: 'Updated Audit Employee',
            },
          );

          assert.equal(
            update.status,
            200,
          );

          const deactivate = await api(
            'PATCH',
            `/employees/${employeeId}/deactivate`,
          );

          assert.equal(
            deactivate.status,
            200,
          );

          const auditRecords =
            await prisma.auditLog.findMany({
              where: {
                companyId: adminCompanyId,
                module: 'employees',
                recordId: employeeId,
              },
            });

          const actions = auditRecords.map(
            (item: { action: any; }) => item.action,
          );

          assert.ok(
            actions.includes('CREATE'),
            'CREATE audit record missing',
          );

          assert.ok(
            actions.includes('UPDATE'),
            'UPDATE audit record missing',
          );

          assert.ok(
            actions.includes('DEACTIVATE'),
            'DEACTIVATE audit record missing',
          );

          assert.ok(
  auditRecords.every(
    (item) => item.userId === adminId,
  ),
  'Incorrect audit actor',
);
        },
      );

      // ==================================
      // TEST 10: FAILED MUTATION AUDIT
      // ==================================

      await t.test(
        'Rejected mutations do not modify foreign data or audit history',

        async () => {
          const before =
            await prisma.auditLog.count({
              where: {
                module: 'employees',
                recordId: foreignEmployeeId,
              },
            });

          const response = await api(
            'PATCH',
            `/employees/${foreignEmployeeId}`,
            {
              fullName: 'Unauthorized Modification',
            },
          );

          assert.equal(
            response.status,
            404,
          );

          const after =
            await prisma.auditLog.count({
              where: {
                module: 'employees',
                recordId: foreignEmployeeId,
              },
            });

          assert.equal(
            after,
            before,
            'Rejected request created an audit record',
          );

          const employee =
            await prisma.employee.findUniqueOrThrow({
              where: {
                id: foreignEmployeeId,
              },
            });

          assert.equal(
            employee.fullName,
            'Foreign Test Employee',
          );
        },
      );
      // ==========================================
// TEST: PROJECT / SITE CONCURRENCY
// ==========================================

await t.test(
  'Concurrent site creation and project deactivation preserve consistency',

  async () => {
    // 1. Create a disposable project through the API.

    const projectCode = code('LOCK-PRJ');

    const projectResponse = await api(
      'POST',
      '/projects',
      {
        name: 'Concurrency Test Project',
        code: projectCode,
      },
    );

    assert.equal(
      projectResponse.status,
      201,
    );

    const projectId = record(
      created.projects,
      getId(projectResponse),
    );

    // 2. Submit both operations concurrently.

    const siteResponsePromise = api(
      'POST',
      '/sites',
      {
        projectId,
        name: 'Concurrency Test Site',
        code: code('LOCK-SITE'),
      },
    );

    const deactivateResponsePromise = api(
      'PATCH',
      `/projects/${projectId}/deactivate`,
    );

    const [
      siteResponse,
      deactivateResponse,
    ] = await Promise.all([
      siteResponsePromise,
      deactivateResponsePromise,
    ]);

    // 3. Register any created site for cleanup.

    const storedSites = await prisma.site.findMany({
      where: {
        projectId,
      },
    });

    for (const site of storedSites) {
      record(
        created.sites,
        site.id,
      );
    }

    // 4. Check the final database state.

    const project =
      await prisma.project.findUniqueOrThrow({
        where: {
          id: projectId,
        },
      });

    const activeSiteCount =
      storedSites.filter(
        site => site.isActive,
      ).length;

    // The critical security invariant:
    // An inactive project must never contain active sites.

    assert.ok(
      project.isActive || activeSiteCount === 0,
      'SECURITY FAILURE: inactive project contains an active site',
    );

    // 5. Check the expected HTTP outcomes.

    const siteCreated =
      siteResponse.status === 201;

    const projectDeactivated =
      deactivateResponse.status === 200;

    // Exactly one of these operations should succeed.
    assert.notEqual(
      siteCreated,
      projectDeactivated,
      'Unexpected concurrent operation results',
    );

    if (siteCreated) {
      assert.equal(
        deactivateResponse.status,
        409,
        'Project deactivation should reject active sites',
      );

      assert.equal(
        project.isActive,
        true,
      );

      assert.equal(
        activeSiteCount,
        1,
      );
    } else {
      assert.equal(
        siteResponse.status,
        404,
        'Site creation should reject an inactive project',
      );

      assert.equal(
        deactivateResponse.status,
        200,
      );

      assert.equal(
        project.isActive,
        false,
      );

      assert.equal(
        activeSiteCount,
        0,
      );
    }
  },
);
// ==========================================
// TEST: DEPARTMENT / EMPLOYEE CREATION RACE
// ==========================================

await t.test(
  'Concurrent employee creation and department deactivation preserve consistency',

  async () => {
    // 1. Create a disposable department.

    const departmentResponse = await api(
      'POST',
      '/departments',
      {
        name: `Creation Race Department ${runId}`,
        description: 'Concurrency regression test',
      },
    );

    assert.equal(
      departmentResponse.status,
      201,
    );

    const departmentId = record(
      created.departments,
      getId(departmentResponse),
    );

    // 2. Start the operations concurrently.

    const employeeNumber =
      code('RACE-EMP-CREATE');

    const [
      employeeResponse,
      deactivateResponse,
    ] = await Promise.all([
      api(
        'POST',
        '/employees',
        {
          employeeNumber,
          fullName: 'Creation Race Employee',
          departmentId,
        },
      ),

      api(
        'PATCH',
        `/departments/${departmentId}/deactivate`,
      ),
    ]);

    // 3. Find any employee created by the race.
    // Register it BEFORE asserting, so cleanup
    // can remove it even if the test fails.

    const createdEmployees =
      await prisma.employee.findMany({
        where: {
          companyId: adminCompanyId,
          employeeNumber,
        },
      });

    for (const employee of createdEmployees) {
      record(
        created.employees,
        employee.id,
      );
    }

    // 4. Read the final department state.

    const department =
      await prisma.department.findUniqueOrThrow({
        where: {
          id: departmentId,
        },
      });

    const activeEmployees =
      await prisma.employee.count({
        where: {
          companyId: adminCompanyId,
          departmentId,
          isActive: true,
        },
      });

    // 5. The critical invariant.

    assert.ok(
      department.isActive ||
        activeEmployees === 0,
      'SECURITY FAILURE: inactive department contains an active employee',
    );

    // 6. Exactly one operation should succeed.

    const employeeCreated =
      employeeResponse.status === 201;

    const departmentDeactivated =
      deactivateResponse.status === 200;

    assert.notEqual(
      employeeCreated,
      departmentDeactivated,
      'Unexpected concurrent operation results',
    );

    if (employeeCreated) {
      // Employee creation won the lock.

      assert.equal(
        deactivateResponse.status,
        409,
      );

      assert.equal(
        department.isActive,
        true,
      );

      assert.equal(
        activeEmployees,
        1,
      );
    } else {
      // Department deactivation won the lock.

      assert.equal(
        employeeResponse.status,
        400,
      );

      assert.equal(
        deactivateResponse.status,
        200,
      );

      assert.equal(
        department.isActive,
        false,
      );

      assert.equal(
        activeEmployees,
        0,
      );
    }
  },
);

// ==========================================
// TEST: DEPARTMENT / EMPLOYEE TRANSFER RACE
// ==========================================

await t.test(
  'Concurrent employee reassignment and department deactivation preserve consistency',

  async () => {
    // 1. Create a destination department.

    const departmentResponse = await api(
      'POST',
      '/departments',
      {
        name: `Transfer Race Department ${runId}`,
        description: 'Employee transfer race test',
      },
    );

    assert.equal(
      departmentResponse.status,
      201,
    );

    const departmentId = record(
      created.departments,
      getId(departmentResponse),
    );

    // 2. Create an employee without a department.

    const employeeResponse = await api(
      'POST',
      '/employees',
      {
        employeeNumber:
          code('RACE-EMP-TRANSFER'),

        fullName:
          'Transfer Race Employee',
      },
    );

    assert.equal(
      employeeResponse.status,
      201,
    );

    const employeeId = record(
      created.employees,
      getId(employeeResponse),
    );

    // 3. Race employee reassignment against
    // department deactivation.

    const [
      transferResponse,
      deactivateResponse,
    ] = await Promise.all([
      api(
        'PATCH',
        `/employees/${employeeId}`,
        {
          departmentId,
        },
      ),

      api(
        'PATCH',
        `/departments/${departmentId}/deactivate`,
      ),
    ]);

    // 4. Read authoritative database state.

    const department =
      await prisma.department.findUniqueOrThrow({
        where: {
          id: departmentId,
        },
      });

    const employee =
      await prisma.employee.findUniqueOrThrow({
        where: {
          id: employeeId,
        },
      });

    const activeEmployees =
      await prisma.employee.count({
        where: {
          companyId: adminCompanyId,
          departmentId,
          isActive: true,
        },
      });

    // 5. Assert the invariant.

    assert.ok(
      department.isActive ||
        activeEmployees === 0,
      'SECURITY FAILURE: employee assigned to an inactive department',
    );

    // 6. Only one competing operation
    // may succeed.

    const employeeTransferred =
      transferResponse.status === 200;

    const departmentDeactivated =
      deactivateResponse.status === 200;

    assert.notEqual(
      employeeTransferred,
      departmentDeactivated,
      'Unexpected concurrent operation results',
    );

    if (employeeTransferred) {
      // Reassignment won.

      assert.equal(
        deactivateResponse.status,
        409,
      );

      assert.equal(
        department.isActive,
        true,
      );

      assert.equal(
        employee.departmentId,
        departmentId,
      );

      assert.equal(
        activeEmployees,
        1,
      );
    } else {
      // Deactivation won.

      assert.equal(
        transferResponse.status,
        400,
      );

      assert.equal(
        deactivateResponse.status,
        200,
      );

      assert.equal(
        department.isActive,
        false,
      );

      assert.equal(
        employee.departmentId,
        null,
      );

      assert.equal(
        activeEmployees,
        0,
      );
    }
  },
);
      // ==================================
      // TEST 11: ACCOUNT DEACTIVATION
      // ==================================

      await t.test(
        'Disabling an account invalidates API access',

        async () => {
          try {
            // This is the disposable test database.
            await prisma.user.update({
              where: {
                id: adminId,
              },

              data: {
                isActive: false,
              },
            });

            const response = await api(
              'GET',
              '/employees',
            );

            assert.equal(
              response.status,
              401,
              'Disabled user still has API access',
            );
          } finally {
            // Restore the administrator even
            // if the assertion fails.
            await prisma.user.update({
              where: {
                id: adminId,
              },

              data: {
                isActive: originalAdminActive,
              },
            });
          }

          // Verify the restored account works.

          const restored = await api(
            'GET',
            '/employees',
          );

          assert.equal(
            restored.status,
            200,
            'Restored administrator cannot access API',
          );
        },
      );

    } finally {
      // ==================================
      // 9. RESTORE ADMINISTRATOR
      // ==================================

      try {
        if (adminId) {
          await prisma.user.update({
            where: {
              id: adminId,
            },

            data: {
              isActive: originalAdminActive,
              roleId: originalAdminRoleId,
            },
          });
        }

        // ==================================
        // 10. REMOVE FIXTURE AUDIT RECORDS
        // ==================================

        const allRecordIds = [
          ...created.employees,
          ...created.sites,
          ...created.projects,
          ...created.departments,
        ];

        if (allRecordIds.length > 0) {
          await prisma.auditLog.deleteMany({
            where: {
              recordId: {
                in: allRecordIds,
              },
            },
          });
        }

        // ==================================
        // 11. REMOVE SITE ASSIGNMENTS
        // ==================================

        if (created.sites.length > 0) {
          await prisma.userSiteAccess.deleteMany({
            where: {
              siteId: {
                in: created.sites,
              },
            },
          });
        }

        // ==================================
        // 12. REMOVE EMPLOYEES
        // ==================================

        if (created.employees.length > 0) {
          await prisma.employee.deleteMany({
            where: {
              id: {
                in: created.employees,
              },
            },
          });
        }

        // ==================================
        // 13. REMOVE SITES
        // ==================================

        if (created.sites.length > 0) {
          await prisma.site.deleteMany({
            where: {
              id: {
                in: created.sites,
              },
            },
          });
        }

        // ==================================
        // 14. REMOVE PROJECTS
        // ==================================

        if (created.projects.length > 0) {
          await prisma.project.deleteMany({
            where: {
              id: {
                in: created.projects,
              },
            },
          });
        }

        // ==================================
        // 15. REMOVE DEPARTMENTS
        // ==================================

        if (created.departments.length > 0) {
          await prisma.department.deleteMany({
            where: {
              id: {
                in: created.departments,
              },
            },
          });
        }

        // ==================================
        // 16. REMOVE TEST COMPANY
        // ==================================

        if (created.companies.length > 0) {
          await prisma.company.deleteMany({
            where: {
              id: {
                in: created.companies,
              },
            },
          });
        }
      } finally {
        await prisma.$disconnect();
      }
    }
  },
);