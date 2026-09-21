/* eslint-disable react-hooks/set-state-in-effect */
import {
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

interface Department {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  _count: {
    employees: number;
  };
}

interface DepartmentForm {
  name: string;
  description: string;
}

const emptyForm: DepartmentForm = {
  name: '',
  description: '',
};

// ======================================
// MAIN COMPONENT
// ======================================

export default function DepartmentsPage() {
  const {
    token,
    logout,
  } = useAuth();

  // ------------------------------------
  // State
  // ------------------------------------

  const [departments, setDepartments] =
    useState<Department[]>([]);

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
    useState<DepartmentForm>(emptyForm);

  // ------------------------------------
  // LOAD DEPARTMENTS
  // ------------------------------------

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadDepartments() {
      try {
        setLoading(true);
        setError('');

        const response = await fetch(
          `${API_URL}/departments`,
          {
            method: 'GET',

            headers: {
              Authorization: `Bearer ${token}`,
            },

            signal: controller.signal,
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
          (await response.json()) as Department[];

        if (!controller.signal.aborted) {
          setDepartments(data);
        }
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load departments.',
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadDepartments();

    return () => {
      controller.abort();
    };
  }, [token, logout]);

  // ------------------------------------
  // OPEN CREATE FORM
  // ------------------------------------

  const openCreateForm = () => {
    setEditingId(null);

    setForm({
      name: '',
      description: '',
    });

    setError('');
    setSuccess('');

    setShowForm(true);
  };

  // ------------------------------------
  // OPEN EDIT FORM
  // ------------------------------------

  const openEditForm = (
    department: Department,
  ) => {
    if (!department.isActive) {
      return;
    }

    setEditingId(department.id);

    setForm({
      name: department.name,
      description:
        department.description ?? '',
    });

    setError('');
    setSuccess('');

    setShowForm(true);
  };

  // ------------------------------------
  // CLOSE FORM
  // ------------------------------------

  const closeForm = () => {
    if (saving) {
      return;
    }

    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  };

  // ------------------------------------
  // UPDATE FORM FIELD
  // ------------------------------------

  const updateField = (
    field: keyof DepartmentForm,
    value: string,
  ) => {
    setForm(previous => ({
      ...previous,
      [field]: value,
    }));

    setError('');
    setSuccess('');
  };

  // ------------------------------------
  // SAVE DEPARTMENT
  // ------------------------------------

  const handleSave = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!token || saving) {
      return;
    }

    const name = form.name.trim();

    if (!name) {
      setError(
        'Department name is required.',
      );
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const isEditing =
        editingId !== null;

      const url = isEditing
        ? `${API_URL}/departments/${encodeURIComponent(editingId)}`
        : `${API_URL}/departments`;

      const response = await fetch(url, {
        method: isEditing
          ? 'PATCH'
          : 'POST',

        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          name,
          description:
            form.description.trim(),
        }),
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

      // Read the saved record.
      await response.json();

      // Reload the list from the backend.
      const listResponse = await fetch(
        `${API_URL}/departments`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (listResponse.status === 401) {
        logout();
        throw new Error(
          'Your session has expired. Please log in again.',
        );
      }

      if (!listResponse.ok) {
        throw new Error(
          'Department was saved, but the list could not be refreshed.',
        );
      }

      const updatedList =
        (await listResponse.json()) as Department[];

      setDepartments(updatedList);

      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);

      setSuccess(
        isEditing
          ? 'Department updated successfully.'
          : 'Department created successfully.',
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save department.',
      );
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------
  // DEACTIVATE DEPARTMENT
  // ------------------------------------

  const handleDeactivate = async (
    department: Department,
  ) => {
    if (!token || saving) {
      return;
    }

    if (!department.isActive) {
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to deactivate "${department.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(
        `${API_URL}/departments/${encodeURIComponent(department.id)}/deactivate`,
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

      setDepartments(previous =>
        previous.map(item =>
          item.id === department.id
            ? {
                ...item,
                isActive: false,
              }
            : item,
        ),
      );

      setSuccess(
        'Department deactivated successfully.',
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to deactivate department.',
      );
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------
  // SEARCH FILTER
  // ------------------------------------

  const filteredDepartments =
    departments.filter(department => {
      const query =
        search.trim().toLowerCase();

      if (!query) {
        return true;
      }

      return (
        department.name
          .toLowerCase()
          .includes(query) ||

        (department.description ?? '')
          .toLowerCase()
          .includes(query)
      );
    });

  // ------------------------------------
  // STATISTICS
  // ------------------------------------

  const totalDepartments =
    departments.length;

  const activeDepartments =
    departments.filter(
      department => department.isActive,
    ).length;

  const inactiveDepartments =
    totalDepartments - activeDepartments;

  // ======================================
  // RENDER
  // ======================================

  return (
    <main className="management-page">

      {/* PAGE HEADING */}

      <div className="management-heading">

        <div>

          <span className="management-eyebrow">
            ORGANIZATION
          </span>

          <h1>
            Department Management
          </h1>

          <p>
            Manage organizational departments
            and their operational status.
          </p>

        </div>

        <button
          type="button"
          className="department-primary-button"
          onClick={openCreateForm}
          disabled={saving}
        >
          + Add Department
        </button>

      </div>

      {/* SUCCESS MESSAGE */}

      {success && (
        <div
          className="success-message"
          role="status"
        >
          {success}
        </div>
      )}

      {/* ERROR MESSAGE */}

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

          <span>
            Total Departments
          </span>

          <strong>
            {totalDepartments}
          </strong>

        </div>

        <div className="department-stat-card">

          <span>
            Active Departments
          </span>

          <strong>
            {activeDepartments}
          </strong>

        </div>

        <div className="department-stat-card">

          <span>
            Inactive Departments
          </span>

          <strong>
            {inactiveDepartments}
          </strong>

        </div>

      </div>

      {/* CREATE / EDIT FORM */}

      {showForm && (

        <section className="management-card department-form-card">

          <div className="management-card-header">

            <h2>
              {editingId
                ? 'Edit Department'
                : 'Create Department'}
            </h2>

            <p>
              Enter the department information below.
            </p>

          </div>

          <form onSubmit={handleSave}>

            <div className="form-group">

              <label htmlFor="department-name">
                Department Name *
              </label>

              <input
                id="department-name"
                type="text"
                required
                maxLength={150}
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

              <label htmlFor="department-description">
                Description
              </label>

              <textarea
                id="department-description"
                rows={4}
                maxLength={1000}
                value={form.description}
                disabled={saving}
                onChange={event =>
                  updateField(
                    'description',
                    event.target.value,
                  )
                }
              />

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
                    ? 'Update Department'
                    : 'Create Department'}
              </button>

            </div>

          </form>

        </section>

      )}

      {/* DEPARTMENT LIST */}

      <section className="management-card department-list-card">

        <div className="department-list-header">

          <div>
            <h2>
              Departments
            </h2>

            <p>
              View and manage department records.
            </p>
          </div>

          <input
            className="department-search"
            type="search"
            placeholder="Search departments..."
            aria-label="Search departments"
            value={search}
            onChange={event =>
              setSearch(event.target.value)
            }
          />

        </div>

        {loading ? (

          <p className="department-loading">
            Loading departments...
          </p>

        ) : filteredDepartments.length === 0 ? (

          <div className="department-empty">

            <h3>
              No departments found
            </h3>

            <p>
              Create a new department or
              adjust your search.
            </p>

          </div>

        ) : (

          <div className="department-table-wrapper">

            <table className="department-table">

              <thead>

                <tr>

                  <th>
                    Department Name
                  </th>

                  <th>
                    Description
                  </th>

                  <th>
                    Employees
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

                {filteredDepartments.map(
                  department => (

                    <tr key={department.id}>

                      <td className="department-name">
                        {department.name}
                      </td>

                      <td>
                        {department.description || '—'}
                      </td>

                      <td>
                        {department._count.employees}
                      </td>

                      <td>

                        <span
                          className={
                            department.isActive
                              ? 'status-badge active'
                              : 'status-badge inactive'
                          }
                        >
                          {department.isActive
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
                              !department.isActive ||
                              saving
                            }
                            onClick={() =>
                              openEditForm(department)
                            }
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="table-deactivate-button"
                            disabled={
                              !department.isActive ||
                              saving
                            }
                            onClick={() =>
                              handleDeactivate(department)
                            }
                          >
                            Deactivate
                          </button>

                        </div>

                      </td>

                    </tr>

                  ),
                )}

              </tbody>

            </table>

          </div>

        )}

      </section>

    </main>
  );
}