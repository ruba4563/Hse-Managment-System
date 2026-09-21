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
  clientName: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  _count: {
    sites: number;
  };
}

interface ProjectForm {
  name: string;
  code: string;
  clientName: string;
  startDate: string;
  endDate: string;
}

const emptyForm: ProjectForm = {
  name: '',
  code: '',
  clientName: '',
  startDate: '',
  endDate: '',
};

function dateForInput(
  value: string | null,
): string {
  return value
    ? value.slice(0, 10)
    : '';
}

// ======================================
// COMPONENT
// ======================================

export default function ProjectsPage() {
  const {
    token,
    logout,
  } = useAuth();

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
    useState<ProjectForm>({
      ...emptyForm,
    });

  // ======================================
  // LOAD PROJECTS
  // ======================================

  const loadProjects = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) {
        return;
      }

      const response = await fetch(
        `${API_URL}/projects`,
        {
          method: 'GET',

          headers: {
            Authorization: `Bearer ${token}`,
          },

          signal,
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

      const data =
        (await response.json()) as Project[];

      if (!signal?.aborted) {
        setProjects(data);
      }
    },
    [token, logout],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function initialize() {
      try {
        setLoading(true);
        setError('');

        await loadProjects(controller.signal);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load projects.',
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      controller.abort();
    };
  }, [loadProjects]);

  // ======================================
  // CREATE FORM
  // ======================================

  const openCreateForm = () => {
    setEditingId(null);

    setForm({
      ...emptyForm,
    });

    setError('');
    setSuccess('');
    setShowForm(true);
  };

  // ======================================
  // EDIT FORM
  // ======================================

  const openEditForm = (
    project: Project,
  ) => {
    if (!project.isActive) {
      return;
    }

    setEditingId(project.id);

    setForm({
      name: project.name,
      code: project.code,
      clientName: project.clientName ?? '',
      startDate: dateForInput(
        project.startDate,
      ),
      endDate: dateForInput(
        project.endDate,
      ),
    });

    setError('');
    setSuccess('');
    setShowForm(true);
  };

  // ======================================
  // CLOSE FORM
  // ======================================

  const closeForm = () => {
    if (saving) {
      return;
    }

    setShowForm(false);
    setEditingId(null);

    setForm({
      ...emptyForm,
    });

    setError('');
  };

  // ======================================
  // UPDATE FIELD
  // ======================================

  const updateField = (
    field: keyof ProjectForm,
    value: string,
  ) => {
    setForm(previous => ({
      ...previous,
      [field]: value,
    }));

    setError('');
    setSuccess('');
  };

  // ======================================
  // SAVE PROJECT
  // ======================================

  const handleSave = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!token || saving) {
      return;
    }

    const name = form.name.trim();
    const code = form.code.trim();

    if (!name) {
      setError('Project name is required.');
      return;
    }

    if (!editingId && !code) {
      setError('Project code is required.');
      return;
    }

    if (
      form.startDate &&
      form.endDate &&
      form.startDate > form.endDate
    ) {
      setError(
        'Start date cannot be later than end date.',
      );
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    const isEditing =
      editingId !== null;

    try {
      const url = isEditing
        ? `${API_URL}/projects/${encodeURIComponent(editingId)}`
        : `${API_URL}/projects`;

      const payload = {
        name,
        clientName: form.clientName.trim(),

        ...(form.startDate && {
          startDate: form.startDate,
        }),

        ...(form.endDate && {
          endDate: form.endDate,
        }),

        ...(!isEditing && {
          code,
        }),
      };

      const response = await fetch(url, {
        method: isEditing
          ? 'PATCH'
          : 'POST',

        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify(payload),
      });

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

      // The mutation has succeeded.
      // Reload authoritative records from PostgreSQL.
      let refreshError = false;

      try {
        await loadProjects();
      } catch {
        refreshError = true;
      }

      setShowForm(false);
      setEditingId(null);

      setForm({
        ...emptyForm,
      });

      setSuccess(
        isEditing
          ? 'Project updated successfully.'
          : 'Project created successfully.',
      );

      if (refreshError) {
        setError(
          'The project was saved, but the list could not be refreshed. Reload the page.',
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save project.',
      );
    } finally {
      setSaving(false);
    }
  };

  // ======================================
  // DEACTIVATE PROJECT
  // ======================================

  const handleDeactivate = async (
    project: Project,
  ) => {
    if (!token || saving) {
      return;
    }

    if (!project.isActive) {
      return;
    }

    const confirmed = window.confirm(
      `Deactivate "${project.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(
        `${API_URL}/projects/${encodeURIComponent(project.id)}/deactivate`,
        {
          method: 'PATCH',

          headers: {
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

      setProjects(previous =>
        previous.map(item =>
          item.id === project.id
            ? {
                ...item,
                isActive: false,
              }
            : item,
        ),
      );

      setSuccess(
        'Project deactivated successfully.',
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to deactivate project.',
      );
    } finally {
      setSaving(false);
    }
  };

  // ======================================
  // SEARCH
  // ======================================

  const filteredProjects =
    projects.filter(project => {
      const query =
        search.trim().toLowerCase();

      if (!query) {
        return true;
      }

      return (
        project.name
          .toLowerCase()
          .includes(query) ||

        project.code
          .toLowerCase()
          .includes(query) ||

        (project.clientName ?? '')
          .toLowerCase()
          .includes(query)
      );
    });

  // ======================================
  // STATISTICS
  // ======================================

  const totalProjects =
    projects.length;

  const activeProjects =
    projects.filter(
      project => project.isActive,
    ).length;

  const inactiveProjects =
    totalProjects - activeProjects;

  // ======================================
  // RENDER
  // ======================================

  return (
    <main className="management-page">

      {/* HEADER */}

      <div className="management-heading">

        <div>
          <span className="management-eyebrow">
            ORGANIZATION
          </span>

          <h1>
            Project Management
          </h1>

          <p>
            Create, organize, and manage
            company projects.
          </p>
        </div>

        <button
          type="button"
          className="department-primary-button"
          onClick={openCreateForm}
          disabled={saving}
        >
          + Add Project
        </button>

      </div>

      {/* SUCCESS */}

      {success && (
        <div
          className="success-message"
          role="status"
        >
          {success}
        </div>
      )}

      {/* ERROR */}

      {error && (
        <div
          className="error-message"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* STATISTICS */}

      <div className="department-stats">

        <div className="department-stat-card">
          <span>Total Projects</span>
          <strong>{totalProjects}</strong>
        </div>

        <div className="department-stat-card">
          <span>Active Projects</span>
          <strong>{activeProjects}</strong>
        </div>

        <div className="department-stat-card">
          <span>Inactive Projects</span>
          <strong>{inactiveProjects}</strong>
        </div>

      </div>

      {/* CREATE / EDIT FORM */}

      {showForm && (

        <section className="management-card department-form-card">

          <div className="management-card-header">

            <h2>
              {editingId
                ? 'Edit Project'
                : 'Create Project'}
            </h2>

            <p>
              Enter the project information below.
            </p>

          </div>

          <form onSubmit={handleSave}>

            <div className="management-form-grid">

              {/* NAME */}

              <div className="form-group">

                <label htmlFor="project-name">
                  Project Name *
                </label>

                <input
                  id="project-name"
                  type="text"
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

              {/* CODE */}

              <div className="form-group">

                <label htmlFor="project-code">
                  Project Code *
                </label>

                <input
                  id="project-code"
                  type="text"
                  required
                  maxLength={50}
                  value={form.code}
                  disabled={
                    saving || editingId !== null
                  }
                  onChange={event =>
                    updateField(
                      'code',
                      event.target.value,
                    )
                  }
                />

              </div>

              {/* CLIENT */}

              <div className="form-group form-full-width">

                <label htmlFor="project-client">
                  Client Name
                </label>

                <input
                  id="project-client"
                  type="text"
                  maxLength={200}
                  value={form.clientName}
                  disabled={saving}
                  onChange={event =>
                    updateField(
                      'clientName',
                      event.target.value,
                    )
                  }
                />

              </div>

              {/* START DATE */}

              <div className="form-group">

                <label htmlFor="project-start">
                  Start Date
                </label>

                <input
                  id="project-start"
                  type="date"
                  value={form.startDate}
                  disabled={saving}
                  onChange={event =>
                    updateField(
                      'startDate',
                      event.target.value,
                    )
                  }
                />

              </div>

              {/* END DATE */}

              <div className="form-group">

                <label htmlFor="project-end">
                  End Date
                </label>

                <input
                  id="project-end"
                  type="date"
                  value={form.endDate}
                  disabled={saving}
                  onChange={event =>
                    updateField(
                      'endDate',
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
                onClick={closeForm}
                disabled={saving}
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
                  : editingId
                    ? 'Update Project'
                    : 'Create Project'}
              </button>

            </div>

          </form>

        </section>

      )}

      {/* PROJECT LIST */}

      <section className="management-card project-list-card">

        <div className="department-list-header">

          <div>
            <h2>Projects</h2>

            <p>
              View and manage company projects.
            </p>
          </div>

          <input
            className="department-search"
            type="search"
            placeholder="Search projects..."
            aria-label="Search projects"
            value={search}
            onChange={event =>
              setSearch(event.target.value)
            }
          />

        </div>

        {loading ? (

          <p className="department-loading">
            Loading projects...
          </p>

        ) : filteredProjects.length === 0 ? (

          <div className="department-empty">

            <h3>No projects found</h3>

            <p>
              Create a project or adjust your search.
            </p>

          </div>

        ) : (

          <div className="department-table-wrapper">

            <table className="department-table">

              <thead>

                <tr>
                  <th>Project</th>
                  <th>Code</th>
                  <th>Client</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Sites</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>

              </thead>

              <tbody>

                {filteredProjects.map(project => (

                  <tr key={project.id}>

                    <td className="department-name">
                      {project.name}
                    </td>

                    <td>
                      {project.code}
                    </td>

                    <td>
                      {project.clientName || '—'}
                    </td>

                    <td>
                      {dateForInput(project.startDate) || '—'}
                    </td>

                    <td>
                      {dateForInput(project.endDate) || '—'}
                    </td>

                    <td>
                      {project._count.sites}
                    </td>

                    <td>

                      <span
                        className={
                          project.isActive
                            ? 'status-badge active'
                            : 'status-badge inactive'
                        }
                      >
                        {project.isActive
                          ? 'Active'
                          : 'Inactive'}
                      </span>

                    </td>

                    <td>

                      <div className="department-actions">

                        <button
                          type="button"
                          className="table-edit-button"
                          disabled={
                            !project.isActive ||
                            saving
                          }
                          onClick={() =>
                            openEditForm(project)
                          }
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="table-deactivate-button"
                          disabled={
                            !project.isActive ||
                            saving
                          }
                          onClick={() =>
                            handleDeactivate(project)
                          }
                        >
                          Deactivate
                        </button>

                      </div>

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        )}

      </section>

    </main>
  );
}