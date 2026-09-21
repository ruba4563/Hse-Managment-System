/* eslint-disable react-hooks/set-state-in-effect */
import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import type {
  FormEvent,
} from 'react';

import { useAuth } from '../auth/AuthContext';

import {
  API_URL,
  getErrorMessage,
} from '../lib/api';

// ======================================
// TYPES
// ======================================

interface Project {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface Site {
  id: string;
  projectId: string;
  name: string;
  code: string;
  location: string | null;

  latitude: string | number | null;
  longitude: string | number | null;

  isActive: boolean;

  project: {
    id: string;
    name: string;
    code: string;
  };

  _count: {
    userAccess: number;
  };
}

interface SiteForm {
  projectId: string;
  name: string;
  code: string;
  location: string;
  latitude: string;
  longitude: string;
}

interface Assignment {
  id: string;
  userId: string;

  user: {
    id: string;
    username: string;
    email: string;
    isActive: boolean;
  };
}

const emptyForm: SiteForm = {
  projectId: '',
  name: '',
  code: '',
  location: '',
  latitude: '',
  longitude: '',
};

export default function SitesPage() {
  const { token, logout } = useAuth();

  const [sites, setSites] =
    useState<Site[]>([]);

  const [projects, setProjects] =
    useState<Project[]>([]);

  const [search, setSearch] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  const [showForm, setShowForm] =
    useState(false);

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [form, setForm] =
    useState<SiteForm>({ ...emptyForm });

  const [selectedSite, setSelectedSite] =
    useState<Site | null>(null);

  const [assignments, setAssignments] =
    useState<Assignment[]>([]);

  const [assignmentUserId, setAssignmentUserId] =
    useState('');

  // ======================================
  // API HELPER
  // ======================================

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
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.status === 401) {
        logout();

        throw new Error(
          'Your session has expired. Please log in again.',
        );
      }

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response),
        );
      }

      return response;
    },
    [token, logout],
  );

  // ======================================
  // LOAD DATA
  // ======================================

  const loadData = useCallback(
    async (signal?: AbortSignal) => {
      const [sitesResponse, projectsResponse] =
        await Promise.all([
          request('/sites', { signal }),
          request('/projects', { signal }),
        ]);

      const siteData =
        (await sitesResponse.json()) as Site[];

      const projectData =
        (await projectsResponse.json()) as Project[];

      if (!signal?.aborted) {
        setSites(siteData);
        setProjects(projectData);
      }
    },
    [request],
  );

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function initialize() {
      try {
        setLoading(true);
        await loadData(controller.signal);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load sites.',
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => controller.abort();
  }, [token, loadData]);

  // ======================================
  // FORM
  // ======================================

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError('');
    setSuccess('');
    setShowForm(true);
  };

  const openEdit = (site: Site) => {
    if (!site.isActive) return;

    setEditingId(site.id);

    setForm({
      projectId: site.projectId,
      name: site.name,
      code: site.code,
      location: site.location ?? '',
      latitude: site.latitude?.toString() ?? '',
      longitude: site.longitude?.toString() ?? '',
    });

    setError('');
    setSuccess('');
    setShowForm(true);
  };

  const updateField = (
    field: keyof SiteForm,
    value: string,
  ) => {
    setForm(previous => ({
      ...previous,
      [field]: value,
    }));
  };

  // ======================================
  // SAVE
  // ======================================

  const handleSave = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!token || saving) return;

    if (!form.name.trim()) {
      setError('Site name is required.');
      return;
    }

    if (!editingId && !form.projectId) {
      setError('Select a project.');
      return;
    }

    if (
      Boolean(form.latitude) !==
      Boolean(form.longitude)
    ) {
      setError(
        'Latitude and longitude must be provided together.',
      );
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    const isEditing = editingId !== null;

    const coordinates =
      form.latitude && form.longitude
        ? {
            latitude: Number(form.latitude),
            longitude: Number(form.longitude),
          }
        : {};

    const payload = {
      name: form.name.trim(),
      location: form.location.trim(),

      ...coordinates,

      ...(!isEditing && {
        projectId: form.projectId,
        code: form.code.trim(),
      }),
    };

    try {
      const response = await request(
        isEditing
          ? `/sites/${editingId}`
          : '/sites',
        {
          method: isEditing ? 'PATCH' : 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify(payload),
        },
      );

      await response.json();

      await loadData();

      setShowForm(false);
      setEditingId(null);

      setSuccess(
        isEditing
          ? 'Site updated successfully.'
          : 'Site created successfully.',
      );
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

  // ======================================
  // DEACTIVATE
  // ======================================

  const deactivate = async (site: Site) => {
    if (!site.isActive || saving) return;

    if (
      !window.confirm(
        `Deactivate "${site.name}"?`,
      )
    ) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      await request(
        `/sites/${site.id}/deactivate`,
        {
          method: 'PATCH',
        },
      );

      await loadData();

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

  // ======================================
  // ASSIGNMENTS
  // ======================================

  const openAssignments = async (site: Site) => {
    setSelectedSite(site);
    setError('');
    setSuccess('');
    setAssignments([]);

    try {
      const response = await request(
        `/sites/${site.id}/access`,
      );

      const data =
        (await response.json()) as Assignment[];

      setAssignments(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load assignments.',
      );
    }
  };

  const assignUser = async () => {
    if (!selectedSite || !assignmentUserId || saving) {
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await request(
        `/sites/${selectedSite.id}/access`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            userId: assignmentUserId.trim(),
          }),
        },
      );

      const response = await request(
        `/sites/${selectedSite.id}/access`,
      );

      setAssignments(
        (await response.json()) as Assignment[],
      );

      setAssignmentUserId('');

      setSuccess(
        'User assignment processed successfully.',
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

  const removeUser = async (
    userId: string,
  ) => {
    if (!selectedSite || saving) return;

    if (!window.confirm('Remove this assignment?')) {
      return;
    }

    setSaving(true);

    try {
      await request(
        `/sites/${selectedSite.id}/access/${userId}`,
        {
          method: 'DELETE',
        },
      );

      setAssignments(previous =>
        previous.filter(
          assignment => assignment.userId !== userId,
        ),
      );

      setSuccess(
        'Assignment removed successfully.',
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to remove assignment.',
      );
    } finally {
      setSaving(false);
    }
  };

  // ======================================
  // FILTERS
  // ======================================

  const filteredSites = sites.filter(site => {
    const query = search.toLowerCase().trim();

    return (
      site.name.toLowerCase().includes(query) ||
      site.code.toLowerCase().includes(query) ||
      site.project.name.toLowerCase().includes(query)
    );
  });

  const activeCount = sites.filter(
    site => site.isActive,
  ).length;

  // ======================================
  // RENDER
  // ======================================

  return (
    <main className="management-page">

      <div className="management-heading">
        <div>
          <span className="management-eyebrow">
            ORGANIZATION
          </span>

          <h1>Site Management</h1>

          <p>
            Manage project locations and site access.
          </p>
        </div>

        <button
          className="department-primary-button"
          onClick={openCreate}
          disabled={saving}
        >
          + Add Site
        </button>
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="success-message" role="status">
          {success}
        </div>
      )}

      <div className="department-stats">

        <div className="department-stat-card">
          <span>Total Sites</span>
          <strong>{sites.length}</strong>
        </div>

        <div className="department-stat-card">
          <span>Active Sites</span>
          <strong>{activeCount}</strong>
        </div>

        <div className="department-stat-card">
          <span>Inactive Sites</span>
          <strong>{sites.length - activeCount}</strong>
        </div>

      </div>

      {showForm && (
        <section className="management-card department-form-card">

          <div className="management-card-header">
            <h2>
              {editingId ? 'Edit Site' : 'Create Site'}
            </h2>
          </div>

          <form onSubmit={handleSave}>

            <div className="management-form-grid">

              <div className="form-group">
                <label htmlFor="site-project">
                  Project *
                </label>

                <select
                  id="site-project"
                  value={form.projectId}
                  disabled={Boolean(editingId) || saving}
                  required
                  onChange={event =>
                    updateField(
                      'projectId',
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    Select project
                  </option>

                  {projects
                    .filter(project =>
                      project.isActive ||
                      project.id === form.projectId,
                    )
                    .map(project => (
                      <option
                        key={project.id}
                        value={project.id}
                      >
                        {project.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="site-code">
                  Site Code *
                </label>

                <input
                  id="site-code"
                  required
                  maxLength={50}
                  value={form.code}
                  disabled={Boolean(editingId) || saving}
                  onChange={event =>
                    updateField(
                      'code',
                      event.target.value,
                    )
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="site-name">
                  Site Name *
                </label>

                <input
                  id="site-name"
                  required
                  maxLength={200}
                  value={form.name}
                  disabled={saving}
                  onChange={event =>
                    updateField(
                      'name',
                      event.target.value,
                    )
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="site-location">
                  Location
                </label>

                <input
                  id="site-location"
                  maxLength={500}
                  value={form.location}
                  disabled={saving}
                  onChange={event =>
                    updateField(
                      'location',
                      event.target.value,
                    )
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="site-latitude">
                  Latitude
                </label>

                <input
                  id="site-latitude"
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  value={form.latitude}
                  disabled={saving}
                  onChange={event =>
                    updateField(
                      'latitude',
                      event.target.value,
                    )
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="site-longitude">
                  Longitude
                </label>

                <input
                  id="site-longitude"
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  value={form.longitude}
                  disabled={saving}
                  onChange={event =>
                    updateField(
                      'longitude',
                      event.target.value,
                    )
                  }
                />
              </div>

            </div>

            <div className="department-form-actions">

              <button
                type="button"
                className="department-secondary-button"
                onClick={() => setShowForm(false)}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="department-primary-button"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Site'}
              </button>

            </div>

          </form>
        </section>
      )}

      <section className="management-card project-list-card">

        <div className="department-list-header">

          <div>
            <h2>Sites</h2>
            <p>All accessible work locations.</p>
          </div>

          <input
            className="department-search"
            type="search"
            placeholder="Search sites..."
            value={search}
            onChange={event =>
              setSearch(event.target.value)
            }
          />

        </div>

        {loading ? (
          <p>Loading sites...</p>
        ) : (
          <div className="department-table-wrapper">

            <table className="department-table">

              <thead>
                <tr>
                  <th>Site</th>
                  <th>Code</th>
                  <th>Project</th>
                  <th>Location</th>
                  <th>Users</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>

                {filteredSites.map(site => (
                  <tr key={site.id}>

                    <td className="department-name">
                      {site.name}
                    </td>

                    <td>{site.code}</td>

                    <td>{site.project.name}</td>

                    <td>{site.location || '—'}</td>

                    <td>{site._count.userAccess}</td>

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

                        <button
                          className="table-edit-button"
                          disabled={!site.isActive || saving}
                          onClick={() => openEdit(site)}
                        >
                          Edit
                        </button>

                        <button
                          className="table-edit-button"
                          onClick={() =>
                            openAssignments(site)
                          }
                        >
                          Users
                        </button>

                        <button
                          className="table-deactivate-button"
                          disabled={!site.isActive || saving}
                          onClick={() => deactivate(site)}
                        >
                          Deactivate
                        </button>

                      </div>
                    </td>

                  </tr>
                ))}

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

      {/* ASSIGNMENTS PANEL */}

      {selectedSite && (
        <section className="management-card site-assignment-card">

          <div className="department-list-header">
            <div>
              <h2>
                Site Users — {selectedSite.name}
              </h2>
              <p>
                Manage users assigned to this site.
              </p>
            </div>

            <button
              className="department-secondary-button"
              onClick={() => setSelectedSite(null)}
            >
              Close
            </button>
          </div>

          {selectedSite.isActive && (
            <div className="site-assignment-form">

              <input
                type="text"
                placeholder="Enter user UUID"
                aria-label="User UUID"
                value={assignmentUserId}
                onChange={event =>
                  setAssignmentUserId(event.target.value)
                }
              />

              <button
                className="department-primary-button"
                disabled={saving || !assignmentUserId}
                onClick={assignUser}
              >
                Assign User
              </button>

            </div>
          )}

          <div className="department-table-wrapper">

            <table className="department-table">

              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>

                {assignments.map(assignment => (
                  <tr key={assignment.id}>

                    <td>
                      {assignment.user.username}
                    </td>

                    <td>
                      {assignment.user.email}
                    </td>

                    <td>
                      {assignment.user.isActive
                        ? 'Active'
                        : 'Inactive'}
                    </td>

                    <td>
                      <button
                        className="table-deactivate-button"
                        disabled={saving}
                        onClick={() =>
                          removeUser(assignment.userId)
                        }
                      >
                        Remove
                      </button>
                    </td>

                  </tr>
                ))}

              </tbody>

            </table>

          </div>

        </section>
      )}

    </main>
  );
}