import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  FormEvent,
} from 'react';

import {
  API_URL,
  getErrorMessage,
} from '../lib/api';

import {
  useAuth,
} from '../auth/AuthContext';

// =====================================================
// TYPES
// =====================================================

type PermitStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ACTIVE'
  | 'REJECTED'
  | 'CLOSED';

interface PermitTypeRecord {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

interface ProjectRecord {
  id: string;
  name: string;
  code: string;
  clientName?: string | null;
  isActive: boolean;
}

interface SiteRecord {
  id: string;
  projectId: string;
  name: string;
  code: string;
  location: string | null;
  isActive: boolean;

  project?: {
    id: string;
    name: string;
    code: string;
  };
}

interface PermitRecord {
  id: string;

  permitNumber: string;

  permitTypeId: string;
  projectId: string;
  siteId: string;
  requestedById: string;

  location: string | null;
  contractorDepartment: string | null;

  requiredPpe: string[];
  hazards: string[];
  controlMeasures: string[];

  startDateTime: string;
  endDateTime: string;

  status: PermitStatus;

  description: string;

  submittedAt: string | null;

  approvedAt: string | null;
  approvedById: string | null;

  rejectedAt: string | null;
  rejectedById: string | null;
  rejectionReason: string | null;

  activatedAt: string | null;

  closedAt: string | null;
  closedById: string | null;

  createdAt: string;
  updatedAt: string;

  permitType: {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
  };

  project: {
    id: string;
    name: string;
    code: string;
    clientName: string | null;
    isActive: boolean;
  };

  site: {
    id: string;
    name: string;
    code: string;
    location: string | null;
    isActive: boolean;
  };

  requestedBy: {
    id: string;
    username: string;
    email: string;

    employee: {
      id: string;
      employeeNumber: string;
      fullName: string;
      jobTitle: string | null;
    } | null;
  };

  approvedBy: {
    id: string;
    username: string;
  } | null;

  rejectedBy: {
    id: string;
    username: string;
  } | null;

  closedBy: {
    id: string;
    username: string;
  } | null;
}

interface ChecklistItem {
  id: string;
  permitId: string;
  itemText: string;
  isMandatory: boolean;
  isCompleted: boolean;
  displayOrder: number;
  completedAt: string | null;
  completedById: string | null;
  createdAt: string;
  updatedAt: string;

  completedBy?: {
    id: string;
    username: string;
  } | null;
}

interface ApprovalRecord {
  id: string;
  permitId: string;
  approverId: string;

  decision:
    | 'APPROVED'
    | 'REJECTED';

  comments: string | null;

  approvalDate: string;
  createdAt: string;

  approver: {
    id: string;
    username: string;
    email: string;

    employee: {
      fullName: string;
      jobTitle: string | null;
    } | null;
  };
}

interface PermitForm {
  permitTypeId: string;
  projectId: string;
  siteId: string;

  location: string;
  contractorDepartment: string;

  requiredPpe: string;
  hazards: string;
  controlMeasures: string;

  startDateTime: string;
  endDateTime: string;

  description: string;
}

interface ChecklistForm {
  itemText: string;
  isMandatory: boolean;
  displayOrder: string;
}

// =====================================================
// DEFAULT FORM
// =====================================================

const emptyPermitForm: PermitForm = {
  permitTypeId: '',
  projectId: '',
  siteId: '',

  location: '',
  contractorDepartment: '',

  requiredPpe: '',
  hazards: '',
  controlMeasures: '',

  startDateTime: '',
  endDateTime: '',

  description: '',
};

const emptyChecklistForm: ChecklistForm = {
  itemText: '',
  isMandatory: true,
  displayOrder: '0',
};

// =====================================================
// HELPERS
// =====================================================

function parseList(
  value: string,
): string[] {
  return Array.from(
    new Set(
      value
        .split(/\r?\n|,/)
        .map(
          item =>
            item.trim(),
        )
        .filter(
          item =>
            item.length >
            0,
        ),
    ),
  );
}

function arrayToText(
  values: string[],
): string {
  return values.join(
    '\n',
  );
}

function toLocalDateTimeInput(
  value:
    | string
    | null
    | undefined,
): string {
  if (!value) {
    return '';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '';
  }

  const offset =
    date.getTimezoneOffset();

  const local =
    new Date(
      date.getTime() -
        offset *
          60 *
          1000,
    );

  return local
    .toISOString()
    .slice(
      0,
      16,
    );
}

function formatDateTime(
  value:
    | string
    | null
    | undefined,
): string {
  if (!value) {
    return '—';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '—';
  }

  return date.toLocaleString();
}

function statusText(
  status: PermitStatus,
): string {
  switch (status) {
    case 'DRAFT':
      return 'Draft';

    case 'PENDING_APPROVAL':
      return 'Pending Approval';

    case 'APPROVED':
      return 'Approved';

    case 'ACTIVE':
      return 'Active';

    case 'REJECTED':
      return 'Rejected';

    case 'CLOSED':
      return 'Closed';

    default:
      return status;
  }
}

function statusClass(
  status: PermitStatus,
): string {
  switch (status) {
    case 'APPROVED':
    case 'ACTIVE':
      return 'status-badge active';

    case 'REJECTED':
    case 'CLOSED':
      return 'status-badge inactive';

    default:
      return 'status-badge';
  }
}

// =====================================================
// COMPONENT
// =====================================================

export default function PermitsPage() {
  const {
    token,
    logout,
    hasPermission,
  } = useAuth();

  // ===================================================
  // MAIN DATA
  // ===================================================

  const [
    permits,
    setPermits,
  ] =
    useState<PermitRecord[]>([]);

  const [
    permitTypes,
    setPermitTypes,
  ] =
    useState<PermitTypeRecord[]>([]);

  const [
    projects,
    setProjects,
  ] =
    useState<ProjectRecord[]>([]);

  const [
    sites,
    setSites,
  ] =
    useState<SiteRecord[]>([]);

  // ===================================================
  // UI STATE
  // ===================================================

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    success,
    setSuccess,
  ] =
    useState('');

  const [
    search,
    setSearch,
  ] =
    useState('');

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<
      'ALL' |
      PermitStatus
    >('ALL');

  // ===================================================
  // CREATE / EDIT
  // ===================================================

  const [
    showForm,
    setShowForm,
  ] =
    useState(false);

  const [
    editingPermit,
    setEditingPermit,
  ] =
    useState<PermitRecord | null>(
      null,
    );

  const [
    permitForm,
    setPermitForm,
  ] =
    useState<PermitForm>({
      ...emptyPermitForm,
    });

  // ===================================================
  // SELECTED PERMIT
  // ===================================================

  const [
    selectedPermit,
    setSelectedPermit,
  ] =
    useState<PermitRecord | null>(
      null,
    );

  // ===================================================
  // CHECKLIST
  // ===================================================

  const [
    checklist,
    setChecklist,
  ] =
    useState<ChecklistItem[]>([]);

  const [
    checklistLoading,
    setChecklistLoading,
  ] =
    useState(false);

  const [
    checklistForm,
    setChecklistForm,
  ] =
    useState<ChecklistForm>({
      ...emptyChecklistForm,
    });

  // ===================================================
  // APPROVAL HISTORY
  // ===================================================

  const [
    approvals,
    setApprovals,
  ] =
    useState<ApprovalRecord[]>([]);

  const [
    approvalsLoading,
    setApprovalsLoading,
  ] =
    useState(false);

  // ===================================================
  // REJECTION
  // ===================================================

  const [
    rejectPermit,
    setRejectPermit,
  ] =
    useState<PermitRecord | null>(
      null,
    );

  const [
    rejectionReason,
    setRejectionReason,
  ] =
    useState('');

  // ===================================================
  // APPROVAL COMMENTS
  // ===================================================

  const [
    approvePermit,
    setApprovePermit,
  ] =
    useState<PermitRecord | null>(
      null,
    );

  const [
    approvalComments,
    setApprovalComments,
  ] =
    useState('');

  // ===================================================
  // API REQUEST
  // ===================================================

  const request =
    useCallback(
      async (
        path: string,
        options: RequestInit = {},
      ) => {
        const headers =
          new Headers(
            options.headers,
          );

        if (token) {
          headers.set(
            'Authorization',
            `Bearer ${token}`,
          );
        }

        const response =
          await fetch(
            `${API_URL}${path}`,
            {
              ...options,
              headers,
            },
          );

        if (
          response.status ===
          401
        ) {
          logout();

          throw new Error(
            'Your session has expired.',
          );
        }

        if (!response.ok) {
          throw new Error(
            await getErrorMessage(
              response,
            ),
          );
        }

        return response;
      },
      [
        token,
        logout,
      ],
    );

  // ===================================================
  // LOAD MAIN DATA
  // ===================================================

 const loadMainData =
  useCallback(
    async () => {
      const [
        permitsResponse,
        permitTypesResponse,
        projectsResponse,
        sitesResponse,
      ] =
        await Promise.all([
          request(
            '/permits',
          ),

          request(
            '/permits/types',
          ),

          request(
            '/projects',
          ),

          request(
            '/sites',
          ),
        ]);

      const permitsData =
        (await permitsResponse.json()) as PermitRecord[];

      const permitTypesData =
        (await permitTypesResponse.json()) as PermitTypeRecord[];

      const projectsData =
        (await projectsResponse.json()) as ProjectRecord[];

      const sitesData =
        (await sitesResponse.json()) as SiteRecord[];

      setPermits(
        permitsData,
      );

      setPermitTypes(
        permitTypesData,
      );

      setProjects(
        projectsData,
      );

      setSites(
        sitesData,
      );

      // Keep the currently opened permit synchronized
      // without making loadMainData depend on selectedPermit.
      setSelectedPermit(
        current => {
          if (!current) {
            return null;
          }

          return (
            permitsData.find(
              permit =>
                permit.id ===
                current.id,
            ) ??
            current
          );
        },
      );
    },
    [
      request,
    ],
  );

  // ===================================================
  // INITIAL LOAD
  // ===================================================
useEffect(() => {
  let active =
    true;

  async function initialize() {
    try {
      setLoading(
        true,
      );

      setError(
        '',
      );

      await loadMainData();
    } catch (err) {
      if (!active) {
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load permits.',
      );
    } finally {
      if (active) {
        setLoading(
          false,
        );
      }
    }
  }

  void initialize();

  return () => {
    active =
      false;
  };
}, [
  loadMainData,
]);

  // ===================================================
  // AVAILABLE SITES FOR PROJECT
  // ===================================================

  const availableSites =
    useMemo(
      () => {
        if (
          !permitForm.projectId
        ) {
          return [];
        }

        return sites.filter(
          site =>
            (
              site.projectId ===
                permitForm.projectId ||
              site.project?.id ===
                permitForm.projectId
            ) &&
            site.isActive,
        );
      },
      [
        sites,
        permitForm.projectId,
      ],
    );

  // ===================================================
  // FILTERED PERMITS
  // ===================================================

  const filteredPermits =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        return permits.filter(
          permit => {
            if (
              statusFilter !==
                'ALL' &&
              permit.status !==
                statusFilter
            ) {
              return false;
            }

            if (!query) {
              return true;
            }

            return (
              permit.permitNumber
                .toLowerCase()
                .includes(query) ||

              permit.permitType.name
                .toLowerCase()
                .includes(query) ||

              permit.project.name
                .toLowerCase()
                .includes(query) ||

              permit.site.name
                .toLowerCase()
                .includes(query) ||

              permit.description
                .toLowerCase()
                .includes(query) ||

              (
                permit.location ??
                ''
              )
                .toLowerCase()
                .includes(query)
            );
          },
        );
      },
      [
        permits,
        search,
        statusFilter,
      ],
    );

  // ===================================================
  // STATUS COUNTS
  // ===================================================

  const counts =
    useMemo(
      () => ({
        total:
          permits.length,

        draft:
          permits.filter(
            item =>
              item.status ===
              'DRAFT',
          ).length,

        pending:
          permits.filter(
            item =>
              item.status ===
              'PENDING_APPROVAL',
          ).length,

        active:
          permits.filter(
            item =>
              item.status ===
              'ACTIVE',
          ).length,
      }),
      [
        permits,
      ],
    );

  // ===================================================
  // RESET FORM
  // ===================================================

  const resetForm =
    () => {
      setPermitForm({
        ...emptyPermitForm,
      });

      setEditingPermit(
        null,
      );

      setShowForm(
        false,
      );
    };

  // ===================================================
  // START CREATE
  // ===================================================

  const startCreate =
    () => {
      setEditingPermit(
        null,
      );

      setPermitForm({
        ...emptyPermitForm,
      });

      setShowForm(
        true,
      );

      setError(
        '',
      );

      setSuccess(
        '',
      );
    };

  // ===================================================
  // START EDIT
  // ===================================================

  const startEdit =
    (
      permit: PermitRecord,
    ) => {
      setEditingPermit(
        permit,
      );

      setPermitForm({
        permitTypeId:
          permit.permitTypeId,

        projectId:
          permit.projectId,

        siteId:
          permit.siteId,

        location:
          permit.location ??
          '',

        contractorDepartment:
          permit.contractorDepartment ??
          '',

        requiredPpe:
          arrayToText(
            permit.requiredPpe,
          ),

        hazards:
          arrayToText(
            permit.hazards,
          ),

        controlMeasures:
          arrayToText(
            permit.controlMeasures,
          ),

        startDateTime:
          toLocalDateTimeInput(
            permit.startDateTime,
          ),

        endDateTime:
          toLocalDateTimeInput(
            permit.endDateTime,
          ),

        description:
          permit.description,
      });

      setShowForm(
        true,
      );

      setError(
        '',
      );

      setSuccess(
        '',
      );

      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    };

  // ===================================================
  // SAVE PERMIT
  // ===================================================

  const savePermit =
    async (
      event:
        FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      if (saving) {
        return;
      }

      if (
        !permitForm.permitTypeId ||
        !permitForm.projectId ||
        !permitForm.siteId
      ) {
        setError(
          'Permit type, project, and site are required.',
        );

        return;
      }

      if (
        !permitForm.startDateTime ||
        !permitForm.endDateTime
      ) {
        setError(
          'Start and end date/time are required.',
        );

        return;
      }

      if (
        permitForm.description
          .trim()
          .length <
        3
      ) {
        setError(
          'Description is required.',
        );

        return;
      }

      const startDate =
        new Date(
          permitForm.startDateTime,
        );

      const endDate =
        new Date(
          permitForm.endDateTime,
        );

      if (
        endDate.getTime() <=
        startDate.getTime()
      ) {
        setError(
          'End date/time must be later than start date/time.',
        );

        return;
      }

      try {
        setSaving(
          true,
        );

        setError(
          '',
        );

        setSuccess(
          '',
        );

        const body = {
          permitTypeId:
            permitForm.permitTypeId,

          projectId:
            permitForm.projectId,

          siteId:
            permitForm.siteId,

          location:
            permitForm.location.trim(),

          contractorDepartment:
            permitForm.contractorDepartment.trim(),

          requiredPpe:
            parseList(
              permitForm.requiredPpe,
            ),

          hazards:
            parseList(
              permitForm.hazards,
            ),

          controlMeasures:
            parseList(
              permitForm.controlMeasures,
            ),

          startDateTime:
            startDate.toISOString(),

          endDateTime:
            endDate.toISOString(),

          description:
            permitForm.description.trim(),
        };

        if (editingPermit) {
          await request(
            `/permits/${editingPermit.id}`,
            {
              method:
                'PATCH',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify(
                  body,
                ),
            },
          );

          setSuccess(
            'Permit updated successfully.',
          );
        } else {
          await request(
            '/permits',
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify(
                  body,
                ),
            },
          );

          setSuccess(
            'Permit created successfully.',
          );
        }

        resetForm();

        await loadMainData();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to save permit.',
        );
      } finally {
        setSaving(
          false,
        );
      }
    };

  // ===================================================
  // WORKFLOW ACTION
  // ===================================================

  const runWorkflowAction =
    async (
      permit: PermitRecord,
      action:
        | 'submit'
        | 'activate'
        | 'close',
    ) => {
      if (saving) {
        return;
      }

      const labels = {
        submit:
          'submit',

        activate:
          'activate',

        close:
          'close',
      };

      const confirmed =
        window.confirm(
          `Are you sure you want to ${labels[action]} permit ${permit.permitNumber}?`,
        );

      if (!confirmed) {
        return;
      }

      try {
        setSaving(
          true,
        );

        setError(
          '',
        );

        setSuccess(
          '',
        );

        await request(
          `/permits/${permit.id}/${action}`,
          {
            method:
              'POST',
          },
        );

        await loadMainData();

        setSuccess(
          `Permit ${labels[action]} action completed successfully.`,
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : `Unable to ${action} permit.`,
        );
      } finally {
        setSaving(
          false,
        );
      }
    };

  // ===================================================
  // APPROVE
  // ===================================================

  const submitApproval =
    async () => {
      if (
        !approvePermit ||
        saving
      ) {
        return;
      }

      try {
        setSaving(
          true,
        );

        setError(
          '',
        );

        setSuccess(
          '',
        );

        await request(
          `/permits/${approvePermit.id}/approve`,
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                comments:
                  approvalComments
                    .trim(),
              }),
          },
        );

        setApprovePermit(
          null,
        );

        setApprovalComments(
          '',
        );

        await loadMainData();

        setSuccess(
          'Permit approved successfully.',
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to approve permit.',
        );
      } finally {
        setSaving(
          false,
        );
      }
    };

  // ===================================================
  // REJECT
  // ===================================================

  const submitRejection =
    async () => {
      if (
        !rejectPermit ||
        saving
      ) {
        return;
      }

      if (
        rejectionReason
          .trim()
          .length <
        3
      ) {
        setError(
          'Rejection reason must contain at least 3 characters.',
        );

        return;
      }

      try {
        setSaving(
          true,
        );

        setError(
          '',
        );

        setSuccess(
          '',
        );

        await request(
          `/permits/${rejectPermit.id}/reject`,
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                reason:
                  rejectionReason
                    .trim(),
              }),
          },
        );

        setRejectPermit(
          null,
        );

        setRejectionReason(
          '',
        );

        await loadMainData();

        setSuccess(
          'Permit rejected successfully.',
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to reject permit.',
        );
      } finally {
        setSaving(
          false,
        );
      }
    };

  // ===================================================
  // LOAD CHECKLIST
  // ===================================================

const loadChecklist =
  async (
    permit: PermitRecord,
  ) => {
    try {
      setChecklistLoading(
        true,
      );

      const response =
        await request(
          `/permits/${permit.id}/checklist`,
        );

      const data =
        (await response.json()) as ChecklistItem[];

      setChecklist(
        data,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load checklist.',
      );
    } finally {
      setChecklistLoading(
        false,
      );
    }
  };

  // ===================================================
  // LOAD APPROVALS
  // ===================================================

  const loadApprovals =
  async (
    permit: PermitRecord,
  ) => {
    try {
      setApprovalsLoading(
        true,
      );

      const response =
        await request(
          `/permits/${permit.id}/approvals`,
        );

      const data =
        (await response.json()) as ApprovalRecord[];

      setApprovals(
        data,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load approval history.',
      );
    } finally {
      setApprovalsLoading(
        false,
      );
    }
  };
  // ===================================================
  // OPEN DETAILS
  // ===================================================

const openDetails =
  async (
    permit: PermitRecord,
  ) => {
    setError(
      '',
    );

    setSelectedPermit(
      permit,
    );

    setChecklist(
      [],
    );

    setApprovals(
      [],
    );

    try {
      await Promise.all([
        loadChecklist(
          permit,
        ),

        loadApprovals(
          permit,
        ),
      ]);
    } catch {
      // Individual loaders already display their errors.
    }
  };
  // ===================================================
  // CREATE CHECKLIST ITEM
  // ===================================================

  const createChecklistItem =
    async (
      event:
        FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      if (
        !selectedPermit ||
        saving
      ) {
        return;
      }

      if (
        checklistForm.itemText
          .trim()
          .length <
        2
      ) {
        setError(
          'Checklist item text is required.',
        );

        return;
      }

      try {
        setSaving(
          true,
        );

        setError(
          '',
        );

        await request(
          `/permits/${selectedPermit.id}/checklist`,
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                itemText:
                  checklistForm.itemText
                    .trim(),

                isMandatory:
                  checklistForm.isMandatory,

                displayOrder:
                  Number(
                    checklistForm.displayOrder,
                  ) ||
                  0,
              }),
          },
        );

        setChecklistForm({
          ...emptyChecklistForm,
        });

        await loadChecklist(
          selectedPermit,
        );

        setSuccess(
          'Checklist item added.',
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to create checklist item.',
        );
      } finally {
        setSaving(
          false,
        );
      }
    };

  // ===================================================
  // TOGGLE CHECKLIST ITEM
  // ===================================================

  const toggleChecklistItem =
    async (
      item: ChecklistItem,
    ) => {
      if (
        !selectedPermit ||
        saving
      ) {
        return;
      }

      try {
        setSaving(
          true,
        );

        setError(
          '',
        );

        await request(
          `/permits/${selectedPermit.id}/checklist/${item.id}`,
          {
            method:
              'PATCH',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                isCompleted:
                  !item.isCompleted,
              }),
          },
        );

        await loadChecklist(
          selectedPermit,
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to update checklist item.',
        );
      } finally {
        setSaving(
          false,
        );
      }
    };

  // ===================================================
  // DELETE CHECKLIST ITEM
  // ===================================================

  const deleteChecklistItem =
    async (
      item: ChecklistItem,
    ) => {
      if (
        !selectedPermit ||
        saving
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          `Delete checklist item "${item.itemText}"?`,
        );

      if (!confirmed) {
        return;
      }

      try {
        setSaving(
          true,
        );

        setError(
          '',
        );

        await request(
          `/permits/${selectedPermit.id}/checklist/${item.id}`,
          {
            method:
              'DELETE',
          },
        );

        await loadChecklist(
          selectedPermit,
        );

        setSuccess(
          'Checklist item deleted.',
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to delete checklist item.',
        );
      } finally {
        setSaving(
          false,
        );
      }
    };

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <main className="management-page">

      {/* HEADER */}

      <div className="management-heading">

        <div>

          <span className="management-eyebrow">
            HSE OPERATIONS
          </span>

          <h1>
            Permit Management
          </h1>

          <p>
            Create, review, approve,
            activate and close work
            permits.
          </p>

        </div>

        {hasPermission(
          'permits:create',
        ) && (
          <button
            type="button"
            className="department-primary-button"
            disabled={saving}
            onClick={
              showForm
                ? resetForm
                : startCreate
            }
          >
            {showForm
              ? 'Close Form'
              : '+ Create Permit'}
          </button>
        )}

      </div>

      {/* MESSAGES */}

      {error && (
        <div
          className="error-message"
          role="alert"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className="success-message"
          role="status"
        >
          {success}
        </div>
      )}

      {/* STATS */}

      <div className="department-stats">

        <div className="department-stat-card">
          <span>
            Total Permits
          </span>

          <strong>
            {counts.total}
          </strong>
        </div>

        <div className="department-stat-card">
          <span>
            Draft
          </span>

          <strong>
            {counts.draft}
          </strong>
        </div>

        <div className="department-stat-card">
          <span>
            Pending Approval
          </span>

          <strong>
            {counts.pending}
          </strong>
        </div>

        <div className="department-stat-card">
          <span>
            Active
          </span>

          <strong>
            {counts.active}
          </strong>
        </div>

      </div>

      {/* CREATE / EDIT FORM */}

      {showForm && (
        <section className="management-card department-form-card">

          <div className="management-card-header">

            <div>
              <h2>
                {editingPermit
                  ? `Edit ${editingPermit.permitNumber}`
                  : 'Create Permit'}
              </h2>

              <p>
                Complete the work permit
                information below.
              </p>
            </div>

          </div>

          <form
            onSubmit={
              savePermit
            }
          >

            <div className="management-form-grid">

              {/* TYPE */}

              <div className="form-group">

                <label>
                  Permit Type *
                </label>

                <select
                  required
                  disabled={saving}
                  value={
                    permitForm.permitTypeId
                  }
                  onChange={
                    event =>
                      setPermitForm(
                        previous => ({
                          ...previous,

                          permitTypeId:
                            event.target.value,
                        }),
                      )
                  }
                >

                  <option value="">
                    Select permit type
                  </option>

                  {permitTypes.map(
                    type => (
                      <option
                        key={
                          type.id
                        }
                        value={
                          type.id
                        }
                      >
                        {
                          type.name
                        }
                      </option>
                    ),
                  )}

                </select>

              </div>

              {/* PROJECT */}

              <div className="form-group">

                <label>
                  Project *
                </label>

                <select
                  required
                  disabled={saving}
                  value={
                    permitForm.projectId
                  }
                  onChange={
                    event =>
                      setPermitForm(
                        previous => ({
                          ...previous,

                          projectId:
                            event.target.value,

                          siteId:
                            '',
                        }),
                      )
                  }
                >

                  <option value="">
                    Select project
                  </option>

                  {projects
                    .filter(
                      project =>
                        project.isActive,
                    )
                    .map(
                      project => (
                        <option
                          key={
                            project.id
                          }
                          value={
                            project.id
                          }
                        >
                          {
                            project.code
                          }
                          {' — '}
                          {
                            project.name
                          }
                        </option>
                      ),
                    )}

                </select>

              </div>

              {/* SITE */}

              <div className="form-group">

                <label>
                  Site *
                </label>

                <select
                  required
                  disabled={
                    saving ||
                    !permitForm.projectId
                  }
                  value={
                    permitForm.siteId
                  }
                  onChange={
                    event =>
                      setPermitForm(
                        previous => ({
                          ...previous,

                          siteId:
                            event.target.value,
                        }),
                      )
                  }
                >

                  <option value="">
                    Select site
                  </option>

                  {availableSites.map(
                    site => (
                      <option
                        key={
                          site.id
                        }
                        value={
                          site.id
                        }
                      >
                        {
                          site.code
                        }
                        {' — '}
                        {
                          site.name
                        }
                      </option>
                    ),
                  )}

                </select>

              </div>

              {/* LOCATION */}

              <div className="form-group">

                <label>
                  Work Location
                </label>

                <input
                  maxLength={500}
                  disabled={saving}
                  value={
                    permitForm.location
                  }
                  onChange={
                    event =>
                      setPermitForm(
                        previous => ({
                          ...previous,

                          location:
                            event.target.value,
                        }),
                      )
                  }
                />

              </div>

              {/* CONTRACTOR */}

              <div className="form-group">

                <label>
                  Contractor / Department
                </label>

                <input
                  maxLength={500}
                  disabled={saving}
                  value={
                    permitForm.contractorDepartment
                  }
                  onChange={
                    event =>
                      setPermitForm(
                        previous => ({
                          ...previous,

                          contractorDepartment:
                            event.target.value,
                        }),
                      )
                  }
                />

              </div>

              {/* START */}

              <div className="form-group">

                <label>
                  Start Date & Time *
                </label>

                <input
                  type="datetime-local"
                  required
                  disabled={saving}
                  value={
                    permitForm.startDateTime
                  }
                  onChange={
                    event =>
                      setPermitForm(
                        previous => ({
                          ...previous,

                          startDateTime:
                            event.target.value,
                        }),
                      )
                  }
                />

              </div>

              {/* END */}

              <div className="form-group">

                <label>
                  End Date & Time *
                </label>

                <input
                  type="datetime-local"
                  required
                  disabled={saving}
                  value={
                    permitForm.endDateTime
                  }
                  onChange={
                    event =>
                      setPermitForm(
                        previous => ({
                          ...previous,

                          endDateTime:
                            event.target.value,
                        }),
                      )
                  }
                />

              </div>

              {/* DESCRIPTION */}

              <div className="form-group form-full-width">

                <label>
                  Work Description *
                </label>

                <textarea
                  rows={4}
                  required
                  maxLength={5000}
                  disabled={saving}
                  value={
                    permitForm.description
                  }
                  onChange={
                    event =>
                      setPermitForm(
                        previous => ({
                          ...previous,

                          description:
                            event.target.value,
                        }),
                      )
                  }
                />

              </div>

              {/* PPE */}

              <div className="form-group">

                <label>
                  Required PPE
                </label>

                <textarea
                  rows={6}
                  disabled={saving}
                  placeholder={
                    'Safety Helmet\nSafety Glasses\nSafety Shoes'
                  }
                  value={
                    permitForm.requiredPpe
                  }
                  onChange={
                    event =>
                      setPermitForm(
                        previous => ({
                          ...previous,

                          requiredPpe:
                            event.target.value,
                        }),
                      )
                  }
                />

                <small>
                  Enter one item per line.
                </small>

              </div>

              {/* HAZARDS */}

              <div className="form-group">

                <label>
                  Hazards
                </label>

                <textarea
                  rows={6}
                  disabled={saving}
                  placeholder={
                    'Fire risk\nHot surfaces\nFalling objects'
                  }
                  value={
                    permitForm.hazards
                  }
                  onChange={
                    event =>
                      setPermitForm(
                        previous => ({
                          ...previous,

                          hazards:
                            event.target.value,
                        }),
                      )
                  }
                />

                <small>
                  Enter one hazard per line.
                </small>

              </div>

              {/* CONTROLS */}

              <div className="form-group form-full-width">

                <label>
                  Control Measures
                </label>

                <textarea
                  rows={6}
                  disabled={saving}
                  placeholder={
                    'Provide fire extinguisher\nAssign fire watch\nInstall barricades'
                  }
                  value={
                    permitForm.controlMeasures
                  }
                  onChange={
                    event =>
                      setPermitForm(
                        previous => ({
                          ...previous,

                          controlMeasures:
                            event.target.value,
                        }),
                      )
                  }
                />

                <small>
                  Enter one control measure
                  per line.
                </small>

              </div>

            </div>

            <div className="department-form-actions">

              <button
                type="button"
                className="department-secondary-button"
                disabled={saving}
                onClick={
                  resetForm
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="department-primary-button"
                disabled={saving}
              >
                {saving
                  ? 'Saving...'
                  : editingPermit
                    ? 'Update Permit'
                    : 'Create Permit'}
              </button>

            </div>

          </form>

        </section>
      )}

      {/* LIST */}

      <section className="management-card">

        <div className="department-list-header">

          <div>
            <h2>
              Work Permits
            </h2>

            <p>
              Review and manage permit
              workflow.
            </p>
          </div>

          <div className="department-actions">

            <select
              value={
                statusFilter
              }
              onChange={
                event =>
                  setStatusFilter(
                    event.target.value as
                      | 'ALL'
                      | PermitStatus,
                  )
              }
            >
              <option value="ALL">
                All statuses
              </option>

              <option value="DRAFT">
                Draft
              </option>

              <option value="PENDING_APPROVAL">
                Pending Approval
              </option>

              <option value="APPROVED">
                Approved
              </option>

              <option value="ACTIVE">
                Active
              </option>

              <option value="REJECTED">
                Rejected
              </option>

              <option value="CLOSED">
                Closed
              </option>
            </select>

            <input
              type="search"
              className="department-search"
              placeholder="Search permits..."
              value={search}
              onChange={
                event =>
                  setSearch(
                    event.target.value,
                  )
              }
            />

          </div>

        </div>

        {loading ? (
          <p>
            Loading permits...
          </p>
        ) : (
          <div className="department-table-wrapper">

            <table className="department-table">

              <thead>

                <tr>
                  <th>
                    Permit
                  </th>

                  <th>
                    Type
                  </th>

                  <th>
                    Project / Site
                  </th>

                  <th>
                    Validity
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Actions
                  </th>
                </tr>

              </thead>

              <tbody>

                {filteredPermits.map(
                  permit => (
                    <tr
                      key={
                        permit.id
                      }
                    >

                      <td>

                        <strong>
                          {
                            permit.permitNumber
                          }
                        </strong>

                        <div className="user-email-text">
                          {
                            permit.location ??
                            'No location'
                          }
                        </div>

                      </td>

                      <td>
                        {
                          permit.permitType.name
                        }
                      </td>

                      <td>
                        <strong>
                          {
                            permit.project.name
                          }
                        </strong>

                        <div className="user-email-text">
                          {
                            permit.site.name
                          }
                        </div>
                      </td>

                      <td>
                        <div>
                          {formatDateTime(
                            permit.startDateTime,
                          )}
                        </div>

                        <div className="user-email-text">
                          to{' '}
                          {formatDateTime(
                            permit.endDateTime,
                          )}
                        </div>
                      </td>

                      <td>
                        <span
                          className={
                            statusClass(
                              permit.status,
                            )
                          }
                        >
                          {statusText(
                            permit.status,
                          )}
                        </span>
                      </td>

                      <td>

                        <div className="department-actions">

                          <button
                            type="button"
                            className="table-edit-button"
                            disabled={saving}
                            onClick={
                              () =>
                                void openDetails(
                                  permit,
                                )
                            }
                          >
                            Details
                          </button>

                          {permit.status ===
                            'DRAFT' &&
                            hasPermission(
                              'permits:update',
                            ) && (
                              <button
                                type="button"
                                className="table-edit-button"
                                disabled={saving}
                                onClick={
                                  () =>
                                    startEdit(
                                      permit,
                                    )
                                }
                              >
                                Edit
                              </button>
                            )}

                          {permit.status ===
                            'DRAFT' &&
                            hasPermission(
                              'permits:submit',
                            ) && (
                              <button
                                type="button"
                                className="department-primary-button"
                                disabled={saving}
                                onClick={
                                  () =>
                                    void runWorkflowAction(
                                      permit,
                                      'submit',
                                    )
                                }
                              >
                                Submit
                              </button>
                            )}

                          {permit.status ===
                            'PENDING_APPROVAL' &&
                            hasPermission(
                              'permits:approve',
                            ) && (
                              <button
                                type="button"
                                className="department-primary-button"
                                disabled={saving}
                                onClick={
                                  () => {
                                    setApprovePermit(
                                      permit,
                                    );

                                    setApprovalComments(
                                      '',
                                    );
                                  }
                                }
                              >
                                Approve
                              </button>
                            )}

                          {permit.status ===
                            'PENDING_APPROVAL' &&
                            hasPermission(
                              'permits:reject',
                            ) && (
                              <button
                                type="button"
                                className="table-deactivate-button"
                                disabled={saving}
                                onClick={
                                  () => {
                                    setRejectPermit(
                                      permit,
                                    );

                                    setRejectionReason(
                                      '',
                                    );
                                  }
                                }
                              >
                                Reject
                              </button>
                            )}

                          {permit.status ===
                            'APPROVED' &&
                            hasPermission(
                              'permits:activate',
                            ) && (
                              <button
                                type="button"
                                className="department-primary-button"
                                disabled={saving}
                                onClick={
                                  () =>
                                    void runWorkflowAction(
                                      permit,
                                      'activate',
                                    )
                                }
                              >
                                Activate
                              </button>
                            )}

                          {permit.status ===
                            'ACTIVE' &&
                            hasPermission(
                              'permits:close',
                            ) && (
                              <button
                                type="button"
                                className="table-deactivate-button"
                                disabled={saving}
                                onClick={
                                  () =>
                                    void runWorkflowAction(
                                      permit,
                                      'close',
                                    )
                                }
                              >
                                Close
                              </button>
                            )}

                        </div>

                      </td>

                    </tr>
                  ),
                )}

              </tbody>

            </table>

            {filteredPermits.length ===
              0 && (
              <div className="department-empty">
                No permits found.
              </div>
            )}

          </div>
        )}

      </section>

      {/* DETAILS */}

      {selectedPermit && (
        <section className="management-card">

          <div className="management-card-header">

            <div>

              <h2>
                {
                  selectedPermit.permitNumber
                }
              </h2>

              <p>
                Permit details, checklist
                and approval history.
              </p>

            </div>

            <button
              type="button"
              className="department-secondary-button"
              onClick={() => {
                setSelectedPermit(
                  null,
                );

                setChecklist(
                  [],
                );

                setApprovals(
                  [],
                );
              }}
            >
              Close Details
            </button>

          </div>

          <div className="management-form-grid">

            <div className="form-group">
              <label>
                Permit Type
              </label>

              <strong>
                {
                  selectedPermit.permitType.name
                }
              </strong>
            </div>

            <div className="form-group">
              <label>
                Status
              </label>

              <span
                className={
                  statusClass(
                    selectedPermit.status,
                  )
                }
              >
                {statusText(
                  selectedPermit.status,
                )}
              </span>
            </div>

            <div className="form-group">
              <label>
                Project
              </label>

              <span>
                {
                  selectedPermit.project.name
                }
              </span>
            </div>

            <div className="form-group">
              <label>
                Site
              </label>

              <span>
                {
                  selectedPermit.site.name
                }
              </span>
            </div>

            <div className="form-group">
              <label>
                Location
              </label>

              <span>
                {
                  selectedPermit.location ??
                  '—'
                }
              </span>
            </div>

            <div className="form-group">
              <label>
                Contractor / Department
              </label>

              <span>
                {
                  selectedPermit.contractorDepartment ??
                  '—'
                }
              </span>
            </div>

            <div className="form-group form-full-width">
              <label>
                Description
              </label>

              <p>
                {
                  selectedPermit.description
                }
              </p>
            </div>

          </div>

          {/* CHECKLIST */}

          <hr />

          <div className="management-card-header">

            <div>
              <h3>
                Permit Checklist
              </h3>

              <p>
                Mandatory checklist items
                must be completed before
                approval.
              </p>
            </div>

          </div>

          {checklistLoading ? (
            <p>
              Loading checklist...
            </p>
          ) : (
            <>
              {checklist.length ===
                0 ? (
                <p>
                  No checklist items.
                </p>
              ) : (
                <div className="department-table-wrapper">

                  <table className="department-table">

                    <thead>
                      <tr>
                        <th>
                          #
                        </th>

                        <th>
                          Item
                        </th>

                        <th>
                          Required
                        </th>

                        <th>
                          Completed
                        </th>

                        <th>
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>

                      {checklist.map(
                        item => (
                          <tr
                            key={
                              item.id
                            }
                          >

                            <td>
                              {
                                item.displayOrder
                              }
                            </td>

                            <td>
                              {
                                item.itemText
                              }
                            </td>

                            <td>
                              {item.isMandatory
                                ? 'Yes'
                                : 'No'}
                            </td>

                            <td>
                              {item.isCompleted
                                ? 'Yes'
                                : 'No'}
                            </td>

                            <td>

                              <div className="department-actions">

                                {(
                                  selectedPermit.status ===
                                    'DRAFT' ||
                                  selectedPermit.status ===
                                    'PENDING_APPROVAL'
                                ) &&
                                  hasPermission(
                                    'permits:update',
                                  ) && (
                                    <button
                                      type="button"
                                      className="table-edit-button"
                                      disabled={saving}
                                      onClick={
                                        () =>
                                          void toggleChecklistItem(
                                            item,
                                          )
                                      }
                                    >
                                      {item.isCompleted
                                        ? 'Mark Incomplete'
                                        : 'Complete'}
                                    </button>
                                  )}

                                {selectedPermit.status ===
                                  'DRAFT' &&
                                  hasPermission(
                                    'permits:update',
                                  ) && (
                                    <button
                                      type="button"
                                      className="table-deactivate-button"
                                      disabled={saving}
                                      onClick={
                                        () =>
                                          void deleteChecklistItem(
                                            item,
                                          )
                                      }
                                    >
                                      Delete
                                    </button>
                                  )}

                              </div>

                            </td>

                          </tr>
                        ),
                      )}

                    </tbody>

                  </table>

                </div>
              )}

              {selectedPermit.status ===
                'DRAFT' &&
                hasPermission(
                  'permits:update',
                ) && (
                  <form
                    onSubmit={
                      createChecklistItem
                    }
                  >

                    <div className="management-form-grid">

                      <div className="form-group">

                        <label>
                          Checklist Item
                        </label>

                        <input
                          required
                          value={
                            checklistForm.itemText
                          }
                          onChange={
                            event =>
                              setChecklistForm(
                                previous => ({
                                  ...previous,

                                  itemText:
                                    event.target.value,
                                }),
                              )
                          }
                        />

                      </div>

                      <div className="form-group">

                        <label>
                          Display Order
                        </label>

                        <input
                          type="number"
                          min="0"
                          max="10000"
                          value={
                            checklistForm.displayOrder
                          }
                          onChange={
                            event =>
                              setChecklistForm(
                                previous => ({
                                  ...previous,

                                  displayOrder:
                                    event.target.value,
                                }),
                              )
                          }
                        />

                      </div>

                      <div className="form-group">

                        <label>
                          Mandatory
                        </label>

                        <input
                          type="checkbox"
                          checked={
                            checklistForm.isMandatory
                          }
                          onChange={
                            event =>
                              setChecklistForm(
                                previous => ({
                                  ...previous,

                                  isMandatory:
                                    event.target.checked,
                                }),
                              )
                          }
                        />

                      </div>

                    </div>

                    <button
                      type="submit"
                      className="department-primary-button"
                      disabled={saving}
                    >
                      Add Checklist Item
                    </button>

                  </form>
                )}

            </>
          )}

          {/* APPROVAL HISTORY */}

          <hr />

          <div className="management-card-header">

            <div>
              <h3>
                Approval History
              </h3>

              <p>
                Recorded permit approval
                and rejection decisions.
              </p>
            </div>

          </div>

          {approvalsLoading ? (
            <p>
              Loading approval history...
            </p>
          ) : approvals.length ===
            0 ? (
            <p>
              No approval history.
            </p>
          ) : (
            <div className="department-table-wrapper">

              <table className="department-table">

                <thead>

                  <tr>
                    <th>
                      Decision
                    </th>

                    <th>
                      Approver
                    </th>

                    <th>
                      Comments
                    </th>

                    <th>
                      Date
                    </th>
                  </tr>

                </thead>

                <tbody>

                  {approvals.map(
                    approval => (
                      <tr
                        key={
                          approval.id
                        }
                      >

                        <td>
                          {
                            approval.decision
                          }
                        </td>

                        <td>
                          {
                            approval.approver
                              .employee
                              ?.fullName ??
                            approval.approver
                              .username
                          }
                        </td>

                        <td>
                          {
                            approval.comments ??
                            '—'
                          }
                        </td>

                        <td>
                          {formatDateTime(
                            approval.approvalDate,
                          )}
                        </td>

                      </tr>
                    ),
                  )}

                </tbody>

              </table>

            </div>
          )}

        </section>
      )}

      {/* APPROVE PANEL */}

      {approvePermit && (
        <section className="management-card">

          <div className="management-card-header">

            <div>

              <h2>
                Approve Permit
              </h2>

              <p>
                {
                  approvePermit.permitNumber
                }
              </p>

            </div>

          </div>

          <div className="form-group">

            <label>
              Approval Comments
            </label>

            <textarea
              rows={4}
              maxLength={2000}
              disabled={saving}
              value={
                approvalComments
              }
              onChange={
                event =>
                  setApprovalComments(
                    event.target.value,
                  )
              }
            />

          </div>

          <div className="department-form-actions">

            <button
              type="button"
              className="department-secondary-button"
              disabled={saving}
              onClick={() => {
                setApprovePermit(
                  null,
                );

                setApprovalComments(
                  '',
                );
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              className="department-primary-button"
              disabled={saving}
              onClick={
                () =>
                  void submitApproval()
              }
            >
              {saving
                ? 'Approving...'
                : 'Approve Permit'}
            </button>

          </div>

        </section>
      )}

      {/* REJECT PANEL */}

      {rejectPermit && (
        <section className="management-card">

          <div className="management-card-header">

            <div>

              <h2>
                Reject Permit
              </h2>

              <p>
                {
                  rejectPermit.permitNumber
                }
              </p>

            </div>

          </div>

          <div className="form-group">

            <label>
              Rejection Reason *
            </label>

            <textarea
              rows={4}
              required
              minLength={3}
              maxLength={2000}
              disabled={saving}
              value={
                rejectionReason
              }
              onChange={
                event =>
                  setRejectionReason(
                    event.target.value,
                  )
              }
            />

          </div>

          <div className="department-form-actions">

            <button
              type="button"
              className="department-secondary-button"
              disabled={saving}
              onClick={() => {
                setRejectPermit(
                  null,
                );

                setRejectionReason(
                  '',
                );
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              className="table-deactivate-button"
              disabled={
                saving ||
                rejectionReason
                  .trim()
                  .length <
                  3
              }
              onClick={
                () =>
                  void submitRejection()
              }
            >
              {saving
                ? 'Rejecting...'
                : 'Reject Permit'}
            </button>

          </div>

        </section>
      )}

    </main>
  );
}