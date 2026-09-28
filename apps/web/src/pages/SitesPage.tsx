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

import { useAuth } from '../auth/AuthContext';

// =====================================================
// TYPES
// =====================================================

interface ProjectRecord {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface SiteRecord {
  id: string;
  projectId: string;

  name: string;
  code: string;

  location: string | null;

  latitude: string | number | null;
  longitude: string | number | null;

  isActive: boolean;

  createdAt?: string;
  updatedAt?: string;

  project?: {
    id: string;
    name: string;
    code: string;
    isActive: boolean;
  } | null;
}

interface AccessUser {
  id: string;
  username: string;
  email: string;
  isActive: boolean;

  role: {
    id: string;
    name: string;
    isActive?: boolean;
  };

  employee: {
    id: string;
    employeeNumber: string;
    fullName: string;
    jobTitle: string | null;
    isActive?: boolean;

    department?: {
      id: string;
      name: string;
    } | null;
  } | null;

  _count?: {
    siteAccess: number;
  };
}

interface SiteAccessRecord {
  id: string;
  userId: string;
  siteId: string;
}

interface SiteForm {
  projectId: string;
  name: string;
  code: string;
  location: string;
  latitude: string;
  longitude: string;
}

const emptyForm: SiteForm = {
  projectId: '',
  name: '',
  code: '',
  location: '',
  latitude: '',
  longitude: '',
};

// =====================================================
// COMPONENT
// =====================================================

export default function SitesPage() {
  const {
  token,
  logout,
  hasPermission,
} = useAuth();

  // ===================================================
  // SITE STATE
  // ===================================================

  const [sites, setSites] =
    useState<SiteRecord[]>([]);

  const [projects, setProjects] =
    useState<ProjectRecord[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  const [search, setSearch] =
    useState('');

  const [showForm, setShowForm] =
    useState(false);

  const [editingSite, setEditingSite] =
    useState<SiteRecord | null>(null);

  const [form, setForm] =
    useState<SiteForm>({
      ...emptyForm,
    });

  // ===================================================
  // ACCESS STATE
  // ===================================================

  const [
    accessUsers,
    setAccessUsers,
  ] = useState<AccessUser[]>([]);

  const [
    siteAccess,
    setSiteAccess,
  ] = useState<SiteAccessRecord[]>([]);

  const [
    accessSite,
    setAccessSite,
  ] = useState<SiteRecord | null>(null);

  const [
    selectedAccessUserId,
    setSelectedAccessUserId,
  ] = useState('');

  const [
    loadingAccess,
    setLoadingAccess,
  ] = useState(false);

  // ===================================================
  // API HELPER
  // ===================================================

  const request = useCallback(
    async (
      path: string,
      options: RequestInit = {},
    ) => {
      const response = await fetch(
        `${API_URL}${path}`,
        {
          ...options,

          headers: {
            ...options.headers,

            Authorization:
              `Bearer ${token}`,
          },
        },
      );

      if (response.status === 401) {
        logout();

        throw new Error(
          'Your session has expired.',
        );
      }

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response),
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
  // LOAD PROJECTS
  // ===================================================

  const loadProjects =
    useCallback(
      async () => {
        const response =
          await request('/projects');

        const data =
          (await response.json()) as ProjectRecord[];

        setProjects(data);

        return data;
      },
      [request],
    );

  // ===================================================
  // LOAD SITES
  // ===================================================

  const loadSites =
    useCallback(
      async () => {
        const response =
          await request('/sites');

        const data =
          (await response.json()) as SiteRecord[];

        setSites(data);

        return data;
      },
      [request],
    );

  // ===================================================
  // INITIAL LOAD
  // ===================================================

  useEffect(() => {
    async function initialize() {
      try {
        setLoading(true);
        setError('');

        await Promise.all([
          loadProjects(),
          loadSites(),
        ]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load sites.',
        );
      } finally {
        setLoading(false);
      }
    }

    void initialize();
  }, [
    loadProjects,
    loadSites,
  ]);

  // ===================================================
  // FORM HELPERS
  // ===================================================

  const resetForm = () => {
    setForm({
      ...emptyForm,
    });

    setEditingSite(null);

    setShowForm(false);
  };

  const openCreateForm = () => {
    setEditingSite(null);

    setForm({
      ...emptyForm,
    });

    setShowForm(true);

    setAccessSite(null);

    setError('');

    setSuccess('');
  };

  const openEditForm = (
    site: SiteRecord,
  ) => {
    setEditingSite(site);

    setForm({
      projectId:
        site.projectId,

      name:
        site.name,

      code:
        site.code,

      location:
        site.location ?? '',

      latitude:
        site.latitude !== null &&
        site.latitude !== undefined
          ? String(site.latitude)
          : '',

      longitude:
        site.longitude !== null &&
        site.longitude !== undefined
          ? String(site.longitude)
          : '',
    });

    setShowForm(true);

    setAccessSite(null);

    setError('');

    setSuccess('');
  };

  // ===================================================
  // CREATE / UPDATE SITE
  // ===================================================

  const submitSite = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!form.projectId) {
      setError(
        'Select a project.',
      );

      return;
    }

    if (!form.name.trim()) {
      setError(
        'Site name is required.',
      );

      return;
    }

    if (!form.code.trim()) {
      setError(
        'Site code is required.',
      );

      return;
    }

    const latitude =
      form.latitude.trim()
        ? Number(form.latitude)
        : undefined;

    const longitude =
      form.longitude.trim()
        ? Number(form.longitude)
        : undefined;

    if (
      latitude !== undefined &&
      (
        Number.isNaN(latitude) ||
        latitude < -90 ||
        latitude > 90
      )
    ) {
      setError(
        'Latitude must be between -90 and 90.',
      );

      return;
    }

    if (
      longitude !== undefined &&
      (
        Number.isNaN(longitude) ||
        longitude < -180 ||
        longitude > 180
      )
    ) {
      setError(
        'Longitude must be between -180 and 180.',
      );

      return;
    }

    try {
      setSaving(true);

      setError('');

      setSuccess('');

      if (editingSite) {
        await request(
          `/sites/${editingSite.id}`,
          {
            method: 'PATCH',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                name:
                  form.name.trim(),

                location:
                  form.location.trim() ||
                  undefined,

                latitude,
                longitude,
              }),
          },
        );

        setSuccess(
          'Site updated successfully.',
        );
      } else {
        await request(
          '/sites',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                projectId:
                  form.projectId,

                name:
                  form.name.trim(),

                code:
                  form.code.trim(),

                location:
                  form.location.trim() ||
                  undefined,

                latitude,
                longitude,
              }),
          },
        );

        setSuccess(
          'Site created successfully.',
        );
      }

      resetForm();

      await loadSites();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save site.',
      );
    } finally {
      setSaving(false);
    }
  };

  // ===================================================
  // DEACTIVATE SITE
  // ===================================================

  const deactivateSite = async (
    site: SiteRecord,
  ) => {
    if (
      saving ||
      !site.isActive
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Deactivate "${site.name}"?`,
      );

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);

      setError('');

      setSuccess('');

      await request(
        `/sites/${site.id}/deactivate`,
        {
          method: 'PATCH',
        },
      );

      if (
        accessSite?.id ===
        site.id
      ) {
        setAccessSite(null);

        setSiteAccess([]);

        setAccessUsers([]);

        setSelectedAccessUserId('');
      }

      await loadSites();

      setSuccess(
        'Site deactivated successfully.',
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to deactivate site.',
      );
    } finally {
      setSaving(false);
    }
  };

  // ===================================================
  // LOAD USERS FOR ACCESS
  // ===================================================

  const loadAccessUsers =
    useCallback(
      async (): Promise<AccessUser[]> => {
        const response =
          await request('/users');

        const data =
          (await response.json()) as AccessUser[];

        const activeUsers =
          data.filter(
            item =>
              item.isActive,
          );

        setAccessUsers(
          activeUsers,
        );

        return activeUsers;
      },
      [request],
    );

  // ===================================================
  // LOAD SITE ACCESS
  // ===================================================

  const loadSiteAccess =
    useCallback(
      async (
        siteId: string,
      ) => {
        const response =
          await request(
            `/sites/${siteId}/access`,
          );

        const data =
          (await response.json()) as SiteAccessRecord[];

        setSiteAccess(data);

        return data;
      },
      [request],
    );

  // ===================================================
  // OPEN ACCESS MANAGER
  // ===================================================

  const openAccessManager =
    async (
      site: SiteRecord,
    ) => {
      if (!site.isActive) {
        setError(
          'Access cannot be managed for an inactive site.',
        );

        return;
      }

      try {
        setLoadingAccess(true);

        setError('');

        setSuccess('');

        setAccessSite(site);

        setSelectedAccessUserId('');

        setShowForm(false);

        await Promise.all([
          loadAccessUsers(),

          loadSiteAccess(
            site.id,
          ),
        ]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load site access.',
        );

        setAccessSite(null);

        setSiteAccess([]);
      } finally {
        setLoadingAccess(false);
      }
    };

  // ===================================================
  // ASSIGN USER TO SITE
  // ===================================================

  const assignUserToSite =
    async () => {
      if (
        !accessSite ||
        !selectedAccessUserId ||
        saving
      ) {
        return;
      }

      try {
        setSaving(true);

        setError('');

        setSuccess('');

        await request(
          `/sites/${accessSite.id}/access`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                userId:
                  selectedAccessUserId,
              }),
          },
        );

        await loadSiteAccess(
          accessSite.id,
        );

        setSelectedAccessUserId('');

        setSuccess(
          'User assigned to site successfully.',
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to assign user.',
        );
      } finally {
        setSaving(false);
      }
    };

  // ===================================================
  // REMOVE USER FROM SITE
  // ===================================================

  const removeUserFromSite =
    async (
      userId: string,
    ) => {
      if (
        !accessSite ||
        saving
      ) {
        return;
      }

      const assignedUser =
        accessUsers.find(
          item =>
            item.id ===
            userId,
        );

      const displayName =
        assignedUser?.employee
          ?.fullName ??
        assignedUser?.username ??
        'this user';

      const confirmed =
        window.confirm(
          `Remove ${displayName} from "${accessSite.name}"?`,
        );

      if (!confirmed) {
        return;
      }

      try {
        setSaving(true);

        setError('');

        setSuccess('');

        await request(
          `/sites/${accessSite.id}/access/${userId}`,
          {
            method:
              'DELETE',
          },
        );

        await loadSiteAccess(
          accessSite.id,
        );

        setSuccess(
          'Site access removed successfully.',
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to remove site access.',
        );
      } finally {
        setSaving(false);
      }
    };

  // ===================================================
  // ASSIGNED USER IDS
  // ===================================================

  const assignedUserIds =
    useMemo(
      () =>
        new Set(
          siteAccess.map(
            item =>
              item.userId,
          ),
        ),
      [siteAccess],
    );

  // ===================================================
  // USERS AVAILABLE FOR ASSIGNMENT
  // ===================================================

  const availableAccessUsers =
    useMemo(
      () =>
        accessUsers.filter(
          item =>
            !assignedUserIds.has(
              item.id,
            ),
        ),
      [
        accessUsers,
        assignedUserIds,
      ],
    );

  // ===================================================
  // FULL ASSIGNED USER DATA
  // ===================================================

  const assignedAccessUsers =
    useMemo(
      () => {
        return siteAccess
          .map(
            access => {
              const assignedUser =
                accessUsers.find(
                  user =>
                    user.id ===
                    access.userId,
                );

              if (!assignedUser) {
                return null;
              }

              return {
                access,
                user: assignedUser,
              };
            },
          )
          .filter(
            (
              item,
            ): item is {
              access: SiteAccessRecord;
              user: AccessUser;
            } =>
              item !== null,
          );
      },
      [
        siteAccess,
        accessUsers,
      ],
    );

  // ===================================================
  // FILTER SITES
  // ===================================================

  const filteredSites =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        if (!query) {
          return sites;
        }

        return sites.filter(
          site => {
            const projectName =
              site.project?.name ??
              projects.find(
                project =>
                  project.id ===
                  site.projectId,
              )?.name ??
              '';

            return (
              site.name
                .toLowerCase()
                .includes(query) ||

              site.code
                .toLowerCase()
                .includes(query) ||

              (
                site.location ??
                ''
              )
                .toLowerCase()
                .includes(query) ||

              projectName
                .toLowerCase()
                .includes(query)
            );
          },
        );
      },
      [
        sites,
        projects,
        search,
      ],
    );

  // ===================================================
  // COUNTS
  // ===================================================

  const activeSites =
    sites.filter(
      site =>
        site.isActive,
    ).length;

  const inactiveSites =
    sites.length -
    activeSites;

  const activeProjects =
    projects.filter(
      project =>
        project.isActive,
    );

  // ===================================================
  // PROJECT NAME
  // ===================================================

  const getProjectName = (
    site: SiteRecord,
  ) => {
    return (
      site.project?.name ??
      projects.find(
        project =>
          project.id ===
          site.projectId,
      )?.name ??
      'Unknown project'
    );
  };

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <main className="management-page">

      {/* =============================================
          HEADER
      ============================================== */}

      <div className="management-heading">

        <div>
          <span className="management-eyebrow">
            ORGANIZATION
          </span>

          <h1>
            Site Management
          </h1>

          <p>
            Manage project sites,
            locations and user access.
          </p>
        </div>

        {hasPermission(
  'sites:create',
) && (
  <button
    type="button"
    className="department-primary-button"
    disabled={saving}
    onClick={openCreateForm}
  >
    + Add Site
  </button>
)}

      </div>

      {/* =============================================
          MESSAGES
      ============================================== */}

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

      {/* =============================================
          STATS
      ============================================== */}

      <div className="department-stats">

        <div className="department-stat-card">
          <span>
            Total Sites
          </span>

          <strong>
            {sites.length}
          </strong>
        </div>

        <div className="department-stat-card">
          <span>
            Active Sites
          </span>

          <strong>
            {activeSites}
          </strong>
        </div>

        <div className="department-stat-card">
          <span>
            Inactive Sites
          </span>

          <strong>
            {inactiveSites}
          </strong>
        </div>

        <div className="department-stat-card">
          <span>
            Active Projects
          </span>

          <strong>
            {activeProjects.length}
          </strong>
        </div>

      </div>

      {/* =============================================
          CREATE / EDIT FORM
      ============================================== */}

      {showForm && (
        <section className="management-card department-form-card">

          <div className="management-card-header">
            <h2>
              {editingSite
                ? 'Edit Site'
                : 'Create Site'}
            </h2>

            <p>
              {editingSite
                ? 'Update site information.'
                : 'Add a site to an active project.'}
            </p>
          </div>

          <form
            onSubmit={submitSite}
          >

            <div className="management-form-grid">

              {/* PROJECT */}

              <div className="form-group">

                <label htmlFor="siteProject">
                  Project *
                </label>

                <select
                  id="siteProject"
                  required
                  disabled={
                    saving ||
                    editingSite !== null
                  }
                  value={
                    form.projectId
                  }
                  onChange={
                    event =>
                      setForm(
                        previous => ({
                          ...previous,

                          projectId:
                            event.target.value,
                        }),
                      )
                  }
                >
                  <option value="">
                    Select project
                  </option>

                  {activeProjects.map(
                    project => (
                      <option
                        key={
                          project.id
                        }
                        value={
                          project.id
                        }
                      >
                        {project.code}
                        {' — '}
                        {project.name}
                      </option>
                    ),
                  )}

                </select>

              </div>

              {/* NAME */}

              <div className="form-group">

                <label htmlFor="siteName">
                  Site Name *
                </label>

                <input
                  id="siteName"
                  required
                  disabled={saving}
                  value={
                    form.name
                  }
                  onChange={
                    event =>
                      setForm(
                        previous => ({
                          ...previous,

                          name:
                            event.target.value,
                        }),
                      )
                  }
                />

              </div>

              {/* CODE */}

              <div className="form-group">

                <label htmlFor="siteCode">
                  Site Code *
                </label>

                <input
                  id="siteCode"
                  required
                  disabled={
                    saving ||
                    editingSite !== null
                  }
                  value={
                    form.code
                  }
                  onChange={
                    event =>
                      setForm(
                        previous => ({
                          ...previous,

                          code:
                            event.target.value,
                        }),
                      )
                  }
                />

              </div>

              {/* LOCATION */}

              <div className="form-group">

                <label htmlFor="siteLocation">
                  Location
                </label>

                <input
                  id="siteLocation"
                  disabled={saving}
                  value={
                    form.location
                  }
                  onChange={
                    event =>
                      setForm(
                        previous => ({
                          ...previous,

                          location:
                            event.target.value,
                        }),
                      )
                  }
                />

              </div>

              {/* LATITUDE */}

              <div className="form-group">

                <label htmlFor="siteLatitude">
                  Latitude
                </label>

                <input
                  id="siteLatitude"
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  disabled={saving}
                  value={
                    form.latitude
                  }
                  onChange={
                    event =>
                      setForm(
                        previous => ({
                          ...previous,

                          latitude:
                            event.target.value,
                        }),
                      )
                  }
                />

              </div>

              {/* LONGITUDE */}

              <div className="form-group">

                <label htmlFor="siteLongitude">
                  Longitude
                </label>

                <input
                  id="siteLongitude"
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  disabled={saving}
                  value={
                    form.longitude
                  }
                  onChange={
                    event =>
                      setForm(
                        previous => ({
                          ...previous,

                          longitude:
                            event.target.value,
                        }),
                      )
                  }
                />

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
                  : editingSite
                    ? 'Update Site'
                    : 'Create Site'}
              </button>

            </div>

          </form>

        </section>
      )}

      {/* =============================================
          SITE TABLE
      ============================================== */}

      <section className="management-card">

        <div className="department-list-header">

          <div>
            <h2>
              Sites
            </h2>

            <p>
              View and manage project sites.
            </p>
          </div>

          <input
            type="search"
            className="department-search"
            placeholder="Search sites..."
            value={search}
            onChange={
              event =>
                setSearch(
                  event.target.value,
                )
            }
          />

        </div>

        {loading ? (
          <p>
            Loading sites...
          </p>
        ) : (
          <div className="department-table-wrapper">

            <table className="department-table">

              <thead>
                <tr>
                  <th>
                    Site
                  </th>

                  <th>
                    Code
                  </th>

                  <th>
                    Project
                  </th>

                  <th>
                    Location
                  </th>

                  <th>
                    Coordinates
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

                {filteredSites.map(
                  site => (
                    <tr
                      key={
                        site.id
                      }
                    >

                      <td>
                        <strong>
                          {site.name}
                        </strong>
                      </td>

                      <td>
                        {site.code}
                      </td>

                      <td>
                        {
                          getProjectName(
                            site,
                          )
                        }
                      </td>

                      <td>
                        {
                          site.location ??
                          '—'
                        }
                      </td>

                      <td>
                        {site.latitude !== null &&
                        site.latitude !== undefined &&
                        site.longitude !== null &&
                        site.longitude !== undefined
                          ? `${site.latitude}, ${site.longitude}`
                          : '—'}
                      </td>

                      <td>
                        <span
                          className={
                            site.isActive
                              ? 'status-badge active'
                              : 'status-badge inactive'
                          }
                        >
                          {site.isActive
                            ? 'Active'
                            : 'Inactive'}
                        </span>
                      </td>

                      <td>

                        <div className="department-actions">

                          {site.isActive ? (
                            <>
                             {hasPermission(
  'sites:update',
) && (
  <button
    type="button"
    className="table-edit-button"
    disabled={saving}
    onClick={() =>
      openEditForm(
        site,
      )
    }
  >
    Edit
  </button>
)}

                             {hasPermission(
  'sites:assign',
) && (
  <button
    type="button"
    className="table-edit-button"
    disabled={saving}
    onClick={() =>
      void openAccessManager(
        site,
      )
    }
  >
    Manage Access
  </button>
)}

                            {hasPermission(
  'sites:deactivate',
) && (
  <button
    type="button"
    className="table-deactivate-button"
    disabled={saving}
    onClick={() =>
      void deactivateSite(
        site,
      )
    }
  >
    Deactivate
  </button>
)}
                            </>
                          ) : (
                            <span>
                              —
                            </span>
                          )}

                        </div>

                      </td>

                    </tr>
                  ),
                )}

              </tbody>

            </table>

            {filteredSites.length === 0 && (
              <div className="department-empty">
                No sites found.
              </div>
            )}

          </div>
        )}

      </section>

      {/* =============================================
          SITE ACCESS MANAGEMENT
      ============================================== */}

      {accessSite && (
        <section className="management-card site-access-card">

          <div className="management-card-header site-access-header">

            <div>
              <span className="management-eyebrow">
                ACCESS CONTROL
              </span>

              <h2>
                Site Access
              </h2>

              <p>
                Manage users assigned to{' '}
                <strong>
                  {accessSite.name}
                </strong>.
              </p>
            </div>

            <button
              type="button"
              className="department-secondary-button"
              disabled={saving}
              onClick={
                () => {
                  setAccessSite(
                    null,
                  );

                  setSiteAccess(
                    [],
                  );

                  setAccessUsers(
                    [],
                  );

                  setSelectedAccessUserId(
                    '',
                  );
                }
              }
            >
              Close
            </button>

          </div>

          {loadingAccess ? (
            <p>
              Loading site access...
            </p>
          ) : (
            <>

              {/* ASSIGN USER */}

              <div className="site-access-assignment">

                <div className="form-group">

                  <label htmlFor="siteAccessUser">
                    Assign Active User
                  </label>

                  <select
                    id="siteAccessUser"
                    value={
                      selectedAccessUserId
                    }
                    disabled={saving}
                    onChange={
                      event =>
                        setSelectedAccessUserId(
                          event.target.value,
                        )
                    }
                  >
                    <option value="">
                      Select user
                    </option>

                    {availableAccessUsers.map(
                      accessUser => (
                        <option
                          key={
                            accessUser.id
                          }
                          value={
                            accessUser.id
                          }
                        >
                          {accessUser.employee
                            ?.fullName ??
                            accessUser.username}

                          {' — '}

                          {
                            accessUser
                              .role.name
                          }
                        </option>
                      ),
                    )}

                  </select>

                  {availableAccessUsers.length === 0 && (
                    <small>
                      All active users are already assigned.
                    </small>
                  )}

                </div>

                <button
                  type="button"
                  className="department-primary-button"
                  disabled={
                    saving ||
                    !selectedAccessUserId
                  }
                  onClick={
                    () =>
                      void assignUserToSite()
                  }
                >
                  {saving
                    ? 'Working...'
                    : 'Assign User'}
                </button>

              </div>

              {/* ASSIGNED USERS */}

              <div className="department-table-wrapper">

                <table className="department-table">

                  <thead>
                    <tr>
                      <th>
                        User
                      </th>

                      <th>
                        Employee
                      </th>

                      <th>
                        Employee No.
                      </th>

                      <th>
                        Role
                      </th>

                      <th>
                        Email
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>

                    {assignedAccessUsers.map(
                      ({
                        access,
                        user: assignedUser,
                      }) => (
                        <tr
                          key={
                            access.id
                          }
                        >

                          <td>
                            <strong>
                              {
                                assignedUser.username
                              }
                            </strong>
                          </td>

                          <td>
                            {assignedUser.employee
                              ?.fullName ??
                              'Not linked'}
                          </td>

                          <td>
                            {assignedUser.employee
                              ?.employeeNumber ??
                              '—'}
                          </td>

                          <td>
                            {
                              assignedUser
                                .role.name
                            }
                          </td>

                          <td>
                            {
                              assignedUser.email
                            }
                          </td>

                          <td>
                            <span
                              className={
                                assignedUser.isActive
                                  ? 'status-badge active'
                                  : 'status-badge inactive'
                              }
                            >
                              {assignedUser.isActive
                                ? 'Active'
                                : 'Inactive'}
                            </span>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="table-deactivate-button"
                              disabled={saving}
                              onClick={
                                () =>
                                  void removeUserFromSite(
                                    access.userId,
                                  )
                              }
                            >
                              Remove
                            </button>
                          </td>

                        </tr>
                      ),
                    )}

                  </tbody>

                </table>

                {assignedAccessUsers.length === 0 && (
                  <div className="department-empty">
                    No users are assigned to this site.
                  </div>
                )}

              </div>

            </>
          )}

        </section>
      )}

    </main>
  );
}