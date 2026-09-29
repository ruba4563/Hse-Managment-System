import 'dotenv/config';

import assert from 'node:assert/strict';

import {
  test,
} from 'node:test';

import {
  resolve,
} from 'node:path';

import {
  config,
} from 'dotenv';

import {
  hash,
} from 'bcryptjs';

import {
  PrismaClient,
} from '../src/generated/prisma/client.js';

import {
  PrismaPg,
} from '@prisma/adapter-pg';

// =====================================================
// LOAD TEST ENVIRONMENT
// =====================================================

config({
  path: resolve(
    process.cwd(),
    '.env.integration.local',
  ),
});

// =====================================================
// ENVIRONMENT
// =====================================================

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL;

const API_URL =
  process.env.TEST_API_URL ??
  'http://127.0.0.1:3000';

const ADMIN_USERNAME =
  process.env.TEST_ADMIN_USERNAME ??
  'hse_admin';

const ADMIN_PASSWORD =
  process.env.TEST_ADMIN_PASSWORD;

if (!TEST_DATABASE_URL) {
  throw new Error(
    'TEST_DATABASE_URL is missing from .env.integration.local',
  );
}

if (!ADMIN_PASSWORD) {
  throw new Error(
    'TEST_ADMIN_PASSWORD is missing from .env.integration.local',
  );
}

// =====================================================
// SAFETY CHECKS
// =====================================================

const databaseUrl =
  new URL(
    TEST_DATABASE_URL,
  );

const databaseName =
  databaseUrl.pathname
    .replace(
      /^\//,
      '',
    );

if (
  databaseName !==
  'hse_management_test'
) {
  throw new Error(
    `Refusing to run tests against database "${databaseName}". Expected "hse_management_test".`,
  );
}

const apiUrl =
  new URL(
    API_URL,
  );

if (
  apiUrl.hostname !==
    '127.0.0.1' &&
  apiUrl.hostname !==
    'localhost'
) {
  throw new Error(
    'Stage 6 integration tests may only run against localhost.',
  );
}

// =====================================================
// PRISMA
// =====================================================

const prisma =
  new PrismaClient({
    adapter:
      new PrismaPg({
        connectionString:
          TEST_DATABASE_URL,
      }),
  });

// =====================================================
// TYPES
// =====================================================

type JsonObject =
  Record<
    string,
    unknown
  >;

type ApiResult = {
  status: number;
  body: unknown;
};

type CreatedPermit = {
  id: string;
  permitNumber: string;
  status: string;
  siteId: string;
  projectId: string;
};

type ChecklistItem = {
  id: string;
  permitId: string;
  itemText: string;
  isMandatory: boolean;
  isCompleted: boolean;
  completedAt: string | null;
  completedById: string | null;
};

type ApprovalHistoryItem = {
  id: string;
  decision: string;
  comments: string | null;
};

// =====================================================
// HELPERS
// =====================================================

function asObject(
  value: unknown,
): JsonObject {
  assert.ok(
    value !== null &&
      typeof value ===
        'object' &&
      !Array.isArray(
        value,
      ),
    'Expected API response to be an object',
  );

  return value as JsonObject;
}

function asArray(
  value: unknown,
): unknown[] {
  assert.ok(
    Array.isArray(
      value,
    ),
    'Expected API response to be an array',
  );

  return value as unknown[];
}

function readString(
  object: JsonObject,
  key: string,
): string {
  const value =
    object[key];

  assert.equal(
    typeof value,
    'string',
    `Expected "${key}" to be a string`,
  );

  return value as string;
}

function extractToken(
  body: unknown,
): string {
  const object =
    asObject(
      body,
    );

  // ===================================================
  // DIRECT RESPONSE FORMATS
  // ===================================================
  //
  // Supports:
  //
  // {
  //   accessToken: "..."
  // }
  //
  // {
  //   access_token: "..."
  // }
  //
  // {
  //   token: "..."
  // }
  //
  // ===================================================

  const directCandidates = [
    object.accessToken,
    object.access_token,
    object.token,
  ];

  for (
    const candidate
    of directCandidates
  ) {
    if (
      typeof candidate ===
        'string' &&
      candidate.length >
        0
    ) {
      return candidate;
    }
  }

  // ===================================================
  // NESTED "data"
  // ===================================================
  //
  // Supports:
  //
  // {
  //   data: {
  //     accessToken: "..."
  //   }
  // }
  //
  // and equivalent names.
  // ===================================================

  const data =
    object.data;

  if (
    data !== null &&
    typeof data ===
      'object' &&
    !Array.isArray(
      data,
    )
  ) {
    const dataObject =
      data as JsonObject;

    const dataCandidates = [
      dataObject.accessToken,
      dataObject.access_token,
      dataObject.token,
    ];

    for (
      const candidate
      of dataCandidates
    ) {
      if (
        typeof candidate ===
          'string' &&
        candidate.length >
          0
      ) {
        return candidate;
      }
    }
  }

  // ===================================================
  // NESTED "tokens"
  // ===================================================
  //
  // Supports:
  //
  // {
  //   tokens: {
  //     accessToken: "..."
  //   }
  // }
  // ===================================================

  const tokens =
    object.tokens;

  if (
    tokens !== null &&
    typeof tokens ===
      'object' &&
    !Array.isArray(
      tokens,
    )
  ) {
    const tokensObject =
      tokens as JsonObject;

    const tokenCandidates = [
      tokensObject.accessToken,
      tokensObject.access_token,
      tokensObject.token,
    ];

    for (
      const candidate
      of tokenCandidates
    ) {
      if (
        typeof candidate ===
          'string' &&
        candidate.length >
          0
      ) {
        return candidate;
      }
    }
  }

  // ===================================================
  // NESTED "auth"
  // ===================================================

  const auth =
    object.auth;

  if (
    auth !== null &&
    typeof auth ===
      'object' &&
    !Array.isArray(
      auth,
    )
  ) {
    const authObject =
      auth as JsonObject;

    const authCandidates = [
      authObject.accessToken,
      authObject.access_token,
      authObject.token,
    ];

    for (
      const candidate
      of authCandidates
    ) {
      if (
        typeof candidate ===
          'string' &&
        candidate.length >
          0
      ) {
        return candidate;
      }
    }
  }

  throw new Error(
    `Login response did not contain an access token. Received keys: ${Object.keys(
      object,
    ).join(', ')}`,
  );
}

async function parseResponse(
  response: Response,
): Promise<unknown> {
  const text =
    await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(
      text,
    ) as unknown;
  } catch {
    return text;
  }
}

async function apiRequest(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
  } = {},
): Promise<ApiResult> {
  const headers =
    new Headers();

  if (options.token) {
    headers.set(
      'Authorization',
      `Bearer ${options.token}`,
    );
  }

  if (
    options.body !==
    undefined
  ) {
    headers.set(
      'Content-Type',
      'application/json',
    );
  }

  const response =
    await fetch(
      `${API_URL}${path}`,
      {
        method:
          options.method ??
          'GET',

        headers,

        body:
          options.body !==
          undefined
            ? JSON.stringify(
                options.body,
              )
            : undefined,
      },
    );

  return {
    status:
      response.status,

    body:
      await parseResponse(
        response,
      ),
  };
}

async function login(
  username: string,
  password: string,
): Promise<string> {
  const response =
    await apiRequest(
      '/auth/login',
      {
        method:
          'POST',

        body: {
          username,
          password,
        },
      },
    );

  assert.equal(
    response.status,
    200,
    `Login failed for "${username}". Status: ${response.status}. Response: ${JSON.stringify(
      response.body,
    )}`,
  );

  try {
    return extractToken(
      response.body,
    );
  } catch (error) {
    throw new Error(
      `Could not extract JWT for "${username}". Login response: ${JSON.stringify(
        response.body,
      )}. ${
        error instanceof Error
          ? error.message
          : ''
      }`,
    );
  }
}

function futureIso(
  daysFromNow: number,
  hour: number,
): string {
  const date =
    new Date();

  date.setUTCDate(
    date.getUTCDate() +
      daysFromNow,
  );

  date.setUTCHours(
    hour,
    0,
    0,
    0,
  );

  return date.toISOString();
}

function permitPayload(
  permitTypeId: string,
  projectId: string,
  siteId: string,
  suffix: string,
) {
  return {
    permitTypeId,
    projectId,
    siteId,

    location:
      `Integration Test Area ${suffix}`,

    contractorDepartment:
      'Integration Test Department',

    requiredPpe: [
      'Safety Helmet',
      'Safety Shoes',
    ],

    hazards: [
      'Test Hazard',
    ],

    controlMeasures: [
      'Test Control Measure',
    ],

    startDateTime:
      futureIso(
        5,
        8,
      ),

    endDateTime:
      futureIso(
        5,
        17,
      ),

    description:
      `Stage 6 integration permit ${suffix}`,
  };
}

// =====================================================
// TEST SUITE
// =====================================================

test(
  'Stage 6 Permit integration and security suite',
  async t => {
    const runId =
      `${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    const createdPermitIds:
      string[] = [];

    const createdProjectIds:
      string[] = [];

    const createdSiteIds:
      string[] = [];

    const createdUserIds:
      string[] = [];

    const createdRoleIds:
      string[] = [];

    const createdRolePermissionIds:
      string[] = [];

    let foreignCompanyId:
      string | null =
      null;

    let permitTypeId =
      '';

    let localProjectAId =
      '';

    let localProjectBId =
      '';

    let localSiteAId =
      '';

    let localSiteBId =
      '';

    let localSiteCId =
      '';

    let foreignProjectId =
      '';

    let foreignSiteId =
      '';

    let adminId =
      '';

    let adminCompanyId =
      '';

    let adminToken =
      '';

    let restrictedUserId =
      '';

    let restrictedUsername =
      '';

    let restrictedPassword =
      '';

    let restrictedToken =
      '';

    try {
      // =================================================
      // ADMIN
      // =================================================

      const admin =
        await prisma.user.findUnique({
          where: {
            username:
              ADMIN_USERNAME,
          },

          select: {
            id: true,
            companyId: true,
            isActive: true,

            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

      assert.ok(
        admin,
        `Administrator "${ADMIN_USERNAME}" does not exist in the test database`,
      );

      assert.equal(
        admin.isActive,
        true,
        'Test administrator must be active',
      );

      assert.equal(
        admin.role.name,
        'SUPER_ADMIN',
        'TEST_ADMIN_USERNAME must belong to SUPER_ADMIN',
      );

      adminId =
        admin.id;

      adminCompanyId =
        admin.companyId;

      adminToken =
        await login(
          ADMIN_USERNAME,
          ADMIN_PASSWORD,
        );

      // =================================================
      // TEST PERMIT TYPE
      // =================================================

      const permitType =
        await prisma.permitType.create({
          data: {
            name:
              `TEST Permit Type ${runId}`,

            description:
              'Stage 6 automated test permit type',

            isActive:
              true,
          },

          select: {
            id: true,
          },
        });

      permitTypeId =
        permitType.id;

      // =================================================
      // LOCAL PROJECT A
      // =================================================

      const localProjectA =
        await prisma.project.create({
          data: {
            companyId:
              adminCompanyId,

            name:
              `Stage6 Project A ${runId}`,

            code:
              `S6A-${runId}`,

            isActive:
              true,
          },

          select: {
            id: true,
          },
        });

      localProjectAId =
        localProjectA.id;

      createdProjectIds.push(
        localProjectA.id,
      );

      // =================================================
      // LOCAL PROJECT B
      // =================================================

      const localProjectB =
        await prisma.project.create({
          data: {
            companyId:
              adminCompanyId,

            name:
              `Stage6 Project B ${runId}`,

            code:
              `S6B-${runId}`,

            isActive:
              true,
          },

          select: {
            id: true,
          },
        });

      localProjectBId =
        localProjectB.id;

      createdProjectIds.push(
        localProjectB.id,
      );

      // =================================================
      // LOCAL SITES
      // =================================================

      const localSiteA =
        await prisma.site.create({
          data: {
            projectId:
              localProjectAId,

            name:
              `Stage6 Site A ${runId}`,

            code:
              `S6-SA-${runId}`,

            isActive:
              true,
          },

          select: {
            id: true,
          },
        });

      localSiteAId =
        localSiteA.id;

      createdSiteIds.push(
        localSiteA.id,
      );

      const localSiteB =
        await prisma.site.create({
          data: {
            projectId:
              localProjectAId,

            name:
              `Stage6 Site B ${runId}`,

            code:
              `S6-SB-${runId}`,

            isActive:
              true,
          },

          select: {
            id: true,
          },
        });

      localSiteBId =
        localSiteB.id;

      createdSiteIds.push(
        localSiteB.id,
      );

      const localSiteC =
        await prisma.site.create({
          data: {
            projectId:
              localProjectBId,

            name:
              `Stage6 Site C ${runId}`,

            code:
              `S6-SC-${runId}`,

            isActive:
              true,
          },

          select: {
            id: true,
          },
        });

      localSiteCId =
        localSiteC.id;

      createdSiteIds.push(
        localSiteC.id,
      );

      // =================================================
      // FOREIGN TENANT
      // =================================================

      const foreignCompany =
        await prisma.company.create({
          data: {
            name:
              `Stage6 Foreign Company ${runId}`,

            code:
              `S6-F-${runId}`,

            isActive:
              true,
          },

          select: {
            id: true,
          },
        });

      foreignCompanyId =
        foreignCompany.id;

      const foreignProject =
        await prisma.project.create({
          data: {
            companyId:
              foreignCompany.id,

            name:
              `Foreign Project ${runId}`,

            code:
              `FP-${runId}`,

            isActive:
              true,
          },

          select: {
            id: true,
          },
        });

      foreignProjectId =
        foreignProject.id;

      const foreignSite =
        await prisma.site.create({
          data: {
            projectId:
              foreignProject.id,

            name:
              `Foreign Site ${runId}`,

            code:
              `FS-${runId}`,

            isActive:
              true,
          },

          select: {
            id: true,
          },
        });

      foreignSiteId =
        foreignSite.id;

      // =================================================
      // RESTRICTED ROLE
      // =================================================

      const restrictedRole =
        await prisma.role.create({
          data: {
            name:
              `TEST_PERMIT_USER_${runId}`,

            description:
              'Temporary Stage 6 restricted role',

            isActive:
              true,
          },

          select: {
            id: true,
          },
        });

      createdRoleIds.push(
        restrictedRole.id,
      );

      const allowedActions = [
        'read',
        'create',
        'update',
        'submit',
      ];

      const permissions =
        await prisma.permission.findMany({
          where: {
            module:
              'permits',

            action: {
              in:
                allowedActions,
            },
          },

          select: {
            id: true,
            action: true,
          },
        });

      assert.equal(
        permissions.length,
        allowedActions.length,
        'Permit permissions were not seeded correctly in the test database',
      );

      for (
        const permission
        of permissions
      ) {
        const relation =
          await prisma.rolePermission.create({
            data: {
              roleId:
                restrictedRole.id,

              permissionId:
                permission.id,
            },

            select: {
              id: true,
            },
          });

        createdRolePermissionIds.push(
          relation.id,
        );
      }

      restrictedUsername =
        `permit_user_${runId}`;

      restrictedPassword =
        `Test-Permit-${runId}!`;

      const passwordHash =
        await hash(
          restrictedPassword,
          12,
        );

      const restrictedUser =
        await prisma.user.create({
          data: {
            companyId:
              adminCompanyId,

            roleId:
              restrictedRole.id,

            username:
              restrictedUsername,

            email:
              `${restrictedUsername}@example.invalid`,

            passwordHash,

            isActive:
              true,
          },

          select: {
            id: true,
          },
        });

      restrictedUserId =
        restrictedUser.id;

      createdUserIds.push(
        restrictedUser.id,
      );

      await prisma.userSiteAccess.create({
        data: {
          userId:
            restrictedUser.id,

          siteId:
            localSiteAId,
        },
      });

      restrictedToken =
        await login(
          restrictedUsername,
          restrictedPassword,
        );

      // =================================================
      // TEST 1
      // =================================================

      await t.test(
        'Protected permit endpoint rejects missing token',
        async () => {
          const response =
            await apiRequest(
              '/permits',
            );

          assert.equal(
            response.status,
            401,
          );
        },
      );

      // =================================================
      // TEST 2
      // =================================================

      await t.test(
        'Permit type endpoint returns active test type',
        async () => {
          const response =
            await apiRequest(
              '/permits/types',
              {
                token:
                  adminToken,
              },
            );

          assert.equal(
            response.status,
            200,
          );

          const list =
            asArray(
              response.body,
            );

          const found =
            list.some(
              item => {
                const object =
                  asObject(
                    item,
                  );

                return (
                  object.id ===
                  permitTypeId
                );
              },
            );

          assert.equal(
            found,
            true,
          );
        },
      );

      // =================================================
      // TEST 3
      // =================================================

      let primaryPermit:
        CreatedPermit;

      await t.test(
        'Administrator can create a DRAFT permit',
        async () => {
          const response =
            await apiRequest(
              '/permits',
              {
                method:
                  'POST',

                token:
                  adminToken,

                body:
                  permitPayload(
                    permitTypeId,
                    localProjectAId,
                    localSiteAId,
                    'primary',
                  ),
              },
            );

          assert.equal(
            response.status,
            201,
            JSON.stringify(
              response.body,
            ),
          );

          const object =
            asObject(
              response.body,
            );

          primaryPermit = {
            id:
              readString(
                object,
                'id',
              ),

            permitNumber:
              readString(
                object,
                'permitNumber',
              ),

            status:
              readString(
                object,
                'status',
              ),

            siteId:
              readString(
                object,
                'siteId',
              ),

            projectId:
              readString(
                object,
                'projectId',
              ),
          };

          createdPermitIds.push(
            primaryPermit.id,
          );

          assert.equal(
            primaryPermit.status,
            'DRAFT',
          );
        },
      );

      // =================================================
      // TEST 4
      // =================================================

      await t.test(
        'Permit list and detail return created permit',
        async () => {
          const listResponse =
            await apiRequest(
              '/permits',
              {
                token:
                  adminToken,
              },
            );

          assert.equal(
            listResponse.status,
            200,
          );

          const list =
            asArray(
              listResponse.body,
            );

          assert.equal(
            list.some(
              item =>
                asObject(
                  item,
                ).id ===
                primaryPermit.id,
            ),
            true,
          );

          const detailResponse =
            await apiRequest(
              `/permits/${primaryPermit.id}`,
              {
                token:
                  adminToken,
              },
            );

          assert.equal(
            detailResponse.status,
            200,
          );

          assert.equal(
            asObject(
              detailResponse.body,
            ).id,
            primaryPermit.id,
          );
        },
      );

      // =================================================
      // TEST 5
      // =================================================

      await t.test(
        'Draft permit can be updated',
        async () => {
          const response =
            await apiRequest(
              `/permits/${primaryPermit.id}`,
              {
                method:
                  'PATCH',

                token:
                  adminToken,

                body: {
                  description:
                    'Updated Stage 6 integration description',

                  location:
                    'Updated Stage 6 Area',
                },
              },
            );

          assert.equal(
            response.status,
            200,
            JSON.stringify(
              response.body,
            ),
          );

          const object =
            asObject(
              response.body,
            );

          assert.equal(
            object.status,
            'DRAFT',
          );

          assert.equal(
            object.description,
            'Updated Stage 6 integration description',
          );
        },
      );

      // =================================================
      // TEST 6
      // =================================================

      await t.test(
        'Invalid date range is rejected',
        async () => {
          const before =
            await prisma.permit.count();

          const response =
            await apiRequest(
              '/permits',
              {
                method:
                  'POST',

                token:
                  adminToken,

                body: {
                  ...permitPayload(
                    permitTypeId,
                    localProjectAId,
                    localSiteAId,
                    'invalid-date',
                  ),

                  startDateTime:
                    futureIso(
                      6,
                      17,
                    ),

                  endDateTime:
                    futureIso(
                      6,
                      8,
                    ),
                },
              },
            );

          assert.equal(
            response.status,
            400,
          );

          const after =
            await prisma.permit.count();

          assert.equal(
            after,
            before,
          );
        },
      );

      // =================================================
      // TEST 7
      // =================================================

      await t.test(
        'Project and site mismatch is rejected',
        async () => {
          const response =
            await apiRequest(
              '/permits',
              {
                method:
                  'POST',

                token:
                  adminToken,

                body:
                  permitPayload(
                    permitTypeId,
                    localProjectAId,
                    localSiteCId,
                    'mismatch',
                  ),
              },
            );

          assert.equal(
            response.status,
            404,
          );
        },
      );

      // =================================================
      // TEST 8
      // =================================================

      await t.test(
        'Foreign-company project cannot be used',
        async () => {
          const response =
            await apiRequest(
              '/permits',
              {
                method:
                  'POST',

                token:
                  adminToken,

                body:
                  permitPayload(
                    permitTypeId,
                    foreignProjectId,
                    foreignSiteId,
                    'foreign',
                  ),
              },
            );

          assert.equal(
            response.status,
            404,
          );
        },
      );

      // =================================================
      // TEST 9
      // =================================================

      let mandatoryChecklistId =
        '';

      await t.test(
        'Draft checklist supports create, update, list and delete',
        async () => {
          const mandatoryResponse =
            await apiRequest(
              `/permits/${primaryPermit.id}/checklist`,
              {
                method:
                  'POST',

                token:
                  adminToken,

                body: {
                  itemText:
                    'Mandatory Stage 6 checklist item',

                  isMandatory:
                    true,

                  displayOrder:
                    1,
                },
              },
            );

          assert.equal(
            mandatoryResponse.status,
            201,
          );

          mandatoryChecklistId =
            readString(
              asObject(
                mandatoryResponse.body,
              ),
              'id',
            );

          const optionalResponse =
            await apiRequest(
              `/permits/${primaryPermit.id}/checklist`,
              {
                method:
                  'POST',

                token:
                  adminToken,

                body: {
                  itemText:
                    'Temporary optional item',

                  isMandatory:
                    false,

                  displayOrder:
                    2,
                },
              },
            );

          assert.equal(
            optionalResponse.status,
            201,
          );

          const optionalId =
            readString(
              asObject(
                optionalResponse.body,
              ),
              'id',
            );

          const updateResponse =
            await apiRequest(
              `/permits/${primaryPermit.id}/checklist/${mandatoryChecklistId}`,
              {
                method:
                  'PATCH',

                token:
                  adminToken,

                body: {
                  itemText:
                    'Updated mandatory Stage 6 checklist item',
                },
              },
            );

          assert.equal(
            updateResponse.status,
            200,
          );

          const listResponse =
            await apiRequest(
              `/permits/${primaryPermit.id}/checklist`,
              {
                token:
                  adminToken,
              },
            );

          assert.equal(
            listResponse.status,
            200,
          );

          assert.equal(
            asArray(
              listResponse.body,
            ).length,
            2,
          );

          const deleteResponse =
            await apiRequest(
              `/permits/${primaryPermit.id}/checklist/${optionalId}`,
              {
                method:
                  'DELETE',

                token:
                  adminToken,
              },
            );

          assert.equal(
            deleteResponse.status,
            200,
          );

          const remaining =
            await prisma.permitChecklistItem.count({
              where: {
                permitId:
                  primaryPermit.id,
              },
            });

          assert.equal(
            remaining,
            1,
          );
        },
      );

      // =================================================
      // TEST 10
      // =================================================

      await t.test(
        'Submit changes DRAFT to PENDING_APPROVAL and blocks normal edit',
        async () => {
          const submitResponse =
            await apiRequest(
              `/permits/${primaryPermit.id}/submit`,
              {
                method:
                  'POST',

                token:
                  adminToken,
              },
            );

          assert.equal(
            submitResponse.status,
            200,
            JSON.stringify(
              submitResponse.body,
            ),
          );

          assert.equal(
            asObject(
              submitResponse.body,
            ).status,
            'PENDING_APPROVAL',
          );

          const editResponse =
            await apiRequest(
              `/permits/${primaryPermit.id}`,
              {
                method:
                  'PATCH',

                token:
                  adminToken,

                body: {
                  description:
                    'This must not be accepted',
                },
              },
            );

          assert.equal(
            editResponse.status,
            409,
          );
        },
      );

      // =================================================
      // TEST 11
      // =================================================

      await t.test(
        'Checklist structure is locked after submission but completion is allowed',
        async () => {
          const structureResponse =
            await apiRequest(
              `/permits/${primaryPermit.id}/checklist/${mandatoryChecklistId}`,
              {
                method:
                  'PATCH',

                token:
                  adminToken,

                body: {
                  itemText:
                    'Illegal structural change',
                },
              },
            );

          assert.equal(
            structureResponse.status,
            409,
          );

          const completionResponse =
            await apiRequest(
              `/permits/${primaryPermit.id}/checklist/${mandatoryChecklistId}`,
              {
                method:
                  'PATCH',

                token:
                  adminToken,

                body: {
                  isCompleted:
                    true,
                },
              },
            );

          assert.equal(
            completionResponse.status,
            200,
          );

          const completed =
            asObject(
              completionResponse.body,
            );

          assert.equal(
            completed.isCompleted,
            true,
          );

          assert.equal(
            typeof completed.completedAt,
            'string',
          );

          assert.equal(
            completed.completedById,
            adminId,
          );
        },
      );

      // =================================================
      // TEST 12
      // =================================================

      await t.test(
        'Mandatory incomplete checklist blocks approval',
        async () => {
          // Make the mandatory item incomplete again.

          const resetResponse =
            await apiRequest(
              `/permits/${primaryPermit.id}/checklist/${mandatoryChecklistId}`,
              {
                method:
                  'PATCH',

                token:
                  adminToken,

                body: {
                  isCompleted:
                    false,
                },
              },
            );

          assert.equal(
            resetResponse.status,
            200,
          );

          const approveResponse =
            await apiRequest(
              `/permits/${primaryPermit.id}/approve`,
              {
                method:
                  'POST',

                token:
                  adminToken,

                body: {
                  comments:
                    'This approval must fail',
                },
              },
            );

          assert.equal(
            approveResponse.status,
            400,
          );

          const permit =
            await prisma.permit.findUnique({
              where: {
                id:
                  primaryPermit.id,
              },

              select: {
                status: true,
              },
            });

          assert.equal(
            permit?.status,
            'PENDING_APPROVAL',
          );
        },
      );

      // =================================================
      // TEST 13
      // =================================================

      await t.test(
        'Completed mandatory checklist allows approval and records history',
        async () => {
          const completeResponse =
            await apiRequest(
              `/permits/${primaryPermit.id}/checklist/${mandatoryChecklistId}`,
              {
                method:
                  'PATCH',

                token:
                  adminToken,

                body: {
                  isCompleted:
                    true,
                },
              },
            );

          assert.equal(
            completeResponse.status,
            200,
          );

          const approveResponse =
            await apiRequest(
              `/permits/${primaryPermit.id}/approve`,
              {
                method:
                  'POST',

                token:
                  adminToken,

                body: {
                  comments:
                    'Stage 6 automated approval',
                },
              },
            );

          assert.equal(
            approveResponse.status,
            200,
            JSON.stringify(
              approveResponse.body,
            ),
          );

          assert.equal(
            asObject(
              approveResponse.body,
            ).status,
            'APPROVED',
          );

          const historyResponse =
            await apiRequest(
              `/permits/${primaryPermit.id}/approvals`,
              {
                token:
                  adminToken,
              },
            );

          assert.equal(
            historyResponse.status,
            200,
          );

          const history =
            asArray(
              historyResponse.body,
            );

          assert.equal(
            history.length,
            1,
          );

          const decision =
            asObject(
              history[0],
            );

          assert.equal(
            decision.decision,
            'APPROVED',
          );

          assert.equal(
            decision.comments,
            'Stage 6 automated approval',
          );
        },
      );

      // =================================================
      // TEST 14
      // =================================================

      await t.test(
        'Approved permit activates and active permit closes',
        async () => {
          const activateResponse =
            await apiRequest(
              `/permits/${primaryPermit.id}/activate`,
              {
                method:
                  'POST',

                token:
                  adminToken,
              },
            );

          assert.equal(
            activateResponse.status,
            200,
          );

          assert.equal(
            asObject(
              activateResponse.body,
            ).status,
            'ACTIVE',
          );

          const closeResponse =
            await apiRequest(
              `/permits/${primaryPermit.id}/close`,
              {
                method:
                  'POST',

                token:
                  adminToken,
              },
            );

          assert.equal(
            closeResponse.status,
            200,
          );

          assert.equal(
            asObject(
              closeResponse.body,
            ).status,
            'CLOSED',
          );
        },
      );

      // =================================================
      // TEST 15
      // =================================================

      let rejectedPermitId =
        '';

      await t.test(
        'Rejection records immutable approval history',
        async () => {
          const createResponse =
            await apiRequest(
              '/permits',
              {
                method:
                  'POST',

                token:
                  adminToken,

                body:
                  permitPayload(
                    permitTypeId,
                    localProjectAId,
                    localSiteAId,
                    'reject-path',
                  ),
              },
            );

          assert.equal(
            createResponse.status,
            201,
          );

          rejectedPermitId =
            readString(
              asObject(
                createResponse.body,
              ),
              'id',
            );

          createdPermitIds.push(
            rejectedPermitId,
          );

          const submitResponse =
            await apiRequest(
              `/permits/${rejectedPermitId}/submit`,
              {
                method:
                  'POST',

                token:
                  adminToken,
              },
            );

          assert.equal(
            submitResponse.status,
            200,
          );

          const rejectResponse =
            await apiRequest(
              `/permits/${rejectedPermitId}/reject`,
              {
                method:
                  'POST',

                token:
                  adminToken,

                body: {
                  reason:
                    'Stage 6 automated rejection',
                },
              },
            );

          assert.equal(
            rejectResponse.status,
            200,
          );

          assert.equal(
            asObject(
              rejectResponse.body,
            ).status,
            'REJECTED',
          );

          const history =
            await apiRequest(
              `/permits/${rejectedPermitId}/approvals`,
              {
                token:
                  adminToken,
              },
            );

          assert.equal(
            history.status,
            200,
          );

          const list =
            asArray(
              history.body,
            );

          assert.equal(
            list.length,
            1,
          );

          assert.equal(
            asObject(
              list[0],
            ).decision,
            'REJECTED',
          );
        },
      );

      // =================================================
      // TEST 16
      // =================================================

      await t.test(
        'Concurrent approve and reject produce exactly one winner',
        async () => {
          const createResponse =
            await apiRequest(
              '/permits',
              {
                method:
                  'POST',

                token:
                  adminToken,

                body:
                  permitPayload(
                    permitTypeId,
                    localProjectAId,
                    localSiteAId,
                    'decision-race',
                  ),
              },
            );

          assert.equal(
            createResponse.status,
            201,
          );

          const permitId =
            readString(
              asObject(
                createResponse.body,
              ),
              'id',
            );

          createdPermitIds.push(
            permitId,
          );

          const submitResponse =
            await apiRequest(
              `/permits/${permitId}/submit`,
              {
                method:
                  'POST',

                token:
                  adminToken,
              },
            );

          assert.equal(
            submitResponse.status,
            200,
          );

          const [
            approveResponse,
            rejectResponse,
          ] =
            await Promise.all([
              apiRequest(
                `/permits/${permitId}/approve`,
                {
                  method:
                    'POST',

                  token:
                    adminToken,

                  body: {
                    comments:
                      'Concurrency approval',
                  },
                },
              ),

              apiRequest(
                `/permits/${permitId}/reject`,
                {
                  method:
                    'POST',

                  token:
                    adminToken,

                  body: {
                    reason:
                      'Concurrency rejection',
                  },
                },
              ),
            ]);

          const statuses = [
            approveResponse.status,
            rejectResponse.status,
          ].sort(
            (
              first,
              second,
            ) =>
              first -
              second,
          );

          assert.deepEqual(
            statuses,
            [
              200,
              409,
            ],
          );

          const permit =
            await prisma.permit.findUnique({
              where: {
                id:
                  permitId,
              },

              select: {
                status: true,
                approvedAt: true,
                rejectedAt: true,
              },
            });

          assert.ok(
            permit,
          );

          assert.ok(
            permit.status ===
              'APPROVED' ||
              permit.status ===
                'REJECTED',
          );

          if (
            permit.status ===
            'APPROVED'
          ) {
            assert.ok(
              permit.approvedAt,
            );

            assert.equal(
              permit.rejectedAt,
              null,
            );
          } else {
            assert.ok(
              permit.rejectedAt,
            );

            assert.equal(
              permit.approvedAt,
              null,
            );
          }

          const historyCount =
            await prisma.permitApproval.count({
              where: {
                permitId,
              },
            });

          assert.equal(
            historyCount,
            1,
          );
        },
      );

      // =================================================
      // TEST 17
      // =================================================

      await t.test(
        'Concurrent permit creation generates distinct permit numbers',
        async () => {
          const [
            first,
            second,
          ] =
            await Promise.all([
              apiRequest(
                '/permits',
                {
                  method:
                    'POST',

                  token:
                    adminToken,

                  body:
                    permitPayload(
                      permitTypeId,
                      localProjectAId,
                      localSiteAId,
                      'number-race-a',
                    ),
                },
              ),

              apiRequest(
                '/permits',
                {
                  method:
                    'POST',

                  token:
                    adminToken,

                  body:
                    permitPayload(
                      permitTypeId,
                      localProjectAId,
                      localSiteBId,
                      'number-race-b',
                    ),
                },
              ),
            ]);

          assert.equal(
            first.status,
            201,
            JSON.stringify(
              first.body,
            ),
          );

          assert.equal(
            second.status,
            201,
            JSON.stringify(
              second.body,
            ),
          );

          const firstObject =
            asObject(
              first.body,
            );

          const secondObject =
            asObject(
              second.body,
            );

          const firstId =
            readString(
              firstObject,
              'id',
            );

          const secondId =
            readString(
              secondObject,
              'id',
            );

          createdPermitIds.push(
            firstId,
            secondId,
          );

          const firstNumber =
            readString(
              firstObject,
              'permitNumber',
            );

          const secondNumber =
            readString(
              secondObject,
              'permitNumber',
            );

          assert.notEqual(
            firstNumber,
            secondNumber,
          );

          const databaseCount =
            await prisma.permit.count({
              where: {
                permitNumber: {
                  in: [
                    firstNumber,
                    secondNumber,
                  ],
                },
              },
            });

          assert.equal(
            databaseCount,
            2,
          );
        },
      );

      // =================================================
      // TEST 18
      // =================================================

      let hiddenPermitId =
        '';

      await t.test(
        'Restricted user only sees permits for assigned sites',
        async () => {
          const hiddenResponse =
            await apiRequest(
              '/permits',
              {
                method:
                  'POST',

                token:
                  adminToken,

                body:
                  permitPayload(
                    permitTypeId,
                    localProjectAId,
                    localSiteBId,
                    'hidden-site',
                  ),
              },
            );

          assert.equal(
            hiddenResponse.status,
            201,
          );

          hiddenPermitId =
            readString(
              asObject(
                hiddenResponse.body,
              ),
              'id',
            );

          createdPermitIds.push(
            hiddenPermitId,
          );

          const listResponse =
            await apiRequest(
              '/permits',
              {
                token:
                  restrictedToken,
              },
            );

          assert.equal(
            listResponse.status,
            200,
          );

          const list =
            asArray(
              listResponse.body,
            );

          assert.equal(
            list.some(
              item =>
                asObject(
                  item,
                ).id ===
                hiddenPermitId,
            ),
            false,
          );

          assert.equal(
            list.some(
              item =>
                asObject(
                  item,
                ).id ===
                primaryPermit.id,
            ),
            true,
          );

          const hiddenDetail =
            await apiRequest(
              `/permits/${hiddenPermitId}`,
              {
                token:
                  restrictedToken,
              },
            );

          assert.equal(
            hiddenDetail.status,
            404,
          );
        },
      );

      // =================================================
      // TEST 19
      // =================================================

      let restrictedPendingPermitId =
        '';

      await t.test(
        'Restricted user can create only on assigned site and lacks approval permission',
        async () => {
          const deniedCreate =
            await apiRequest(
              '/permits',
              {
                method:
                  'POST',

                token:
                  restrictedToken,

                body:
                  permitPayload(
                    permitTypeId,
                    localProjectAId,
                    localSiteBId,
                    'restricted-denied',
                  ),
              },
            );

          assert.equal(
            deniedCreate.status,
            404,
          );

          const allowedCreate =
            await apiRequest(
              '/permits',
              {
                method:
                  'POST',

                token:
                  restrictedToken,

                body:
                  permitPayload(
                    permitTypeId,
                    localProjectAId,
                    localSiteAId,
                    'restricted-allowed',
                  ),
              },
            );

          assert.equal(
            allowedCreate.status,
            201,
            JSON.stringify(
              allowedCreate.body,
            ),
          );

          restrictedPendingPermitId =
            readString(
              asObject(
                allowedCreate.body,
              ),
              'id',
            );

          createdPermitIds.push(
            restrictedPendingPermitId,
          );

          const submitResponse =
            await apiRequest(
              `/permits/${restrictedPendingPermitId}/submit`,
              {
                method:
                  'POST',

                token:
                  restrictedToken,
              },
            );

          assert.equal(
            submitResponse.status,
            200,
          );

          const approveResponse =
            await apiRequest(
              `/permits/${restrictedPendingPermitId}/approve`,
              {
                method:
                  'POST',

                token:
                  restrictedToken,

                body: {
                  comments:
                    'Should be forbidden',
                },
              },
            );

          assert.equal(
            approveResponse.status,
            403,
          );
        },
      );

      // =================================================
      // TEST 20
      // =================================================

      await t.test(
        'Permit lifecycle produces expected audit records',
        async () => {
          const audits =
            await prisma.auditLog.findMany({
              where: {
                module:
                  'permits',

                recordId:
                  primaryPermit.id,
              },

              select: {
                action: true,
                userId: true,
              },
            });

          const actions =
            audits.map(
              audit =>
                audit.action,
            );

          const expectedActions = [
            'CREATE',
            'UPDATE',
            'CHECKLIST_CREATE',
            'CHECKLIST_UPDATE',
            'CHECKLIST_DELETE',
            'SUBMIT',
            'APPROVE',
            'ACTIVATE',
            'CLOSE',
          ];

          for (
            const action
            of expectedActions
          ) {
            assert.equal(
              actions.includes(
                action,
              ),
              true,
              `Missing ${action} audit record`,
            );
          }

          for (
            const audit
            of audits
          ) {
            assert.equal(
              audit.userId,
              adminId,
            );
          }
        },
      );

      // =================================================
      // TEST 21
      // =================================================

      await t.test(
        'Deactivating user invalidates existing permit API token',
        async () => {
          await prisma.user.update({
            where: {
              id:
                restrictedUserId,
            },

            data: {
              isActive:
                false,
            },
          });

          const disabledResponse =
            await apiRequest(
              '/permits',
              {
                token:
                  restrictedToken,
              },
            );

          assert.equal(
            disabledResponse.status,
            401,
          );

          await prisma.user.update({
            where: {
              id:
                restrictedUserId,
            },

            data: {
              isActive:
                true,
            },
          });

          const restoredResponse =
            await apiRequest(
              '/permits',
              {
                token:
                  restrictedToken,
              },
            );

          assert.equal(
            restoredResponse.status,
            200,
          );
        },
      );
    } finally {
      // =================================================
      // CLEANUP
      // =================================================

      try {
        if (
          restrictedUserId
        ) {
          await prisma.user.updateMany({
            where: {
              id:
                restrictedUserId,
            },

            data: {
              isActive:
                true,
            },
          });
        }

        if (
          createdPermitIds.length >
          0
        ) {
          await prisma.auditLog.deleteMany({
            where: {
              module:
                'permits',

              recordId: {
                in:
                  createdPermitIds,
              },
            },
          });

          // Checklist and approval history use
          // onDelete: Cascade from Permit.

          await prisma.permit.deleteMany({
            where: {
              id: {
                in:
                  createdPermitIds,
              },
            },
          });
        }

        if (
          createdUserIds.length >
          0
        ) {
          await prisma.userSiteAccess.deleteMany({
            where: {
              userId: {
                in:
                  createdUserIds,
              },
            },
          });

          await prisma.user.deleteMany({
            where: {
              id: {
                in:
                  createdUserIds,
              },
            },
          });
        }

        if (
          createdRolePermissionIds.length >
          0
        ) {
          await prisma.rolePermission.deleteMany({
            where: {
              id: {
                in:
                  createdRolePermissionIds,
              },
            },
          });
        }

        if (
          createdRoleIds.length >
          0
        ) {
          await prisma.role.deleteMany({
            where: {
              id: {
                in:
                  createdRoleIds,
              },
            },
          });
        }

        if (
          createdSiteIds.length >
          0
        ) {
          await prisma.site.deleteMany({
            where: {
              id: {
                in:
                  createdSiteIds,
              },
            },
          });
        }

        if (
          createdProjectIds.length >
          0
        ) {
          await prisma.project.deleteMany({
            where: {
              id: {
                in:
                  createdProjectIds,
              },
            },
          });
        }

        if (
          foreignSiteId
        ) {
          await prisma.site.deleteMany({
            where: {
              id:
                foreignSiteId,
            },
          });
        }

        if (
          foreignProjectId
        ) {
          await prisma.project.deleteMany({
            where: {
              id:
                foreignProjectId,
            },
          });
        }

        if (
          foreignCompanyId
        ) {
          await prisma.company.deleteMany({
            where: {
              id:
                foreignCompanyId,
            },
          });
        }

        if (
          permitTypeId
        ) {
          await prisma.permitType.deleteMany({
            where: {
              id:
                permitTypeId,
            },
          });
        }
      } finally {
        await prisma.$disconnect();
      }
    }
  },
);