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

interface Department {
  id: string;
  name: string;
  isActive: boolean;
}

interface Employee {
  id: string;
  employeeNumber: string;
  fullName: string;
  departmentId: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  employmentType: string;
  hireDate: string | null;
  isActive: boolean;

  department: {
    id: string;
    name: string;
  } | null;
}

interface EmployeeForm {
  employeeNumber: string;
  fullName: string;
  departmentId: string;
  email: string;
  phone: string;
  jobTitle: string;
  employmentType: 'EMPLOYEE' | 'CONTRACTOR';
  hireDate: string;
}

const emptyForm: EmployeeForm = {
  employeeNumber: '',
  fullName: '',
  departmentId: '',
  email: '',
  phone: '',
  jobTitle: '',
  employmentType: 'EMPLOYEE',
  hireDate: '',
};

function dateForInput(
  value: string | null,
): string {
  return value ? value.slice(0, 10) : '';
}

// ======================================
// COMPONENT
// ======================================

export default function EmployeesPage() {
  const { token, logout } = useAuth();

  const [employees, setEmployees] =
    useState<Employee[]>([]);

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
    useState<EmployeeForm>({
      ...emptyForm,
    });

  // ======================================
  // API REQUEST
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
      const [employeeResponse, departmentResponse] =
        await Promise.all([
          request('/employees', { signal }),
          request('/departments', { signal }),
        ]);

      const employeeData =
        (await employeeResponse.json()) as Employee[];

      const departmentData =
        (await departmentResponse.json()) as Department[];

      if (!signal?.aborted) {
        setEmployees(employeeData);
        setDepartments(departmentData);
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
              : 'Unable to load employees.',
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
  // FORM ACTIONS
  // ======================================

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError('');
    setSuccess('');
    setShowForm(true);
  };

  const openEdit = (employee: Employee) => {
    if (!employee.isActive) return;

    setEditingId(employee.id);

    setForm({
      employeeNumber: employee.employeeNumber,
      fullName: employee.fullName,
      departmentId: employee.departmentId ?? '',
      email: employee.email ?? '',
      phone: employee.phone ?? '',
      jobTitle: employee.jobTitle ?? '',
      employmentType:
        employee.employmentType === 'CONTRACTOR'
          ? 'CONTRACTOR'
          : 'EMPLOYEE',
      hireDate: dateForInput(employee.hireDate),
    });

    setError('');
    setSuccess('');
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    setError('');
  };

  const updateField = (
    field: keyof EmployeeForm,
    value: string,
  ) => {
    setForm(previous => ({
      ...previous,
      [field]: value,
    }));
  };

  // ======================================
  // SAVE EMPLOYEE
  // ======================================

  const handleSave = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!token || saving) return;

    if (!form.fullName.trim()) {
      setError('Employee name is required.');
      return;
    }

    if (!editingId && !form.employeeNumber.trim()) {
      setError('Employee number is required.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    const isEditing = editingId !== null;

    const payload = {
      fullName: form.fullName.trim(),

      departmentId:
        form.departmentId || null,

      email: form.email.trim(),
      phone: form.phone.trim(),
      jobTitle: form.jobTitle.trim(),

      employmentType: form.employmentType,

      ...(form.hireDate && {
        hireDate: form.hireDate,
      }),

      ...(!isEditing && {
        employeeNumber:
          form.employeeNumber.trim(),
      }),
    };

    try {
      const url = isEditing
        ? `/employees/${editingId}`
        : '/employees';

      await request(url, {
        method: isEditing ? 'PATCH' : 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify(payload),
      });

      setShowForm(false);
      setEditingId(null);
      setForm({ ...emptyForm });

      setSuccess(
        isEditing
          ? 'Employee updated successfully.'
          : 'Employee created successfully.',
      );

      try {
        await loadData();
      } catch (refreshError) {
        setError(
          refreshError instanceof Error
            ? `Saved, but refresh failed: ${refreshError.message}`
            : 'Saved, but the list could not be refreshed.',
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save employee.',
      );
    } finally {
      setSaving(false);
    }
  };

  // ======================================
  // DEACTIVATE
  // ======================================

  const deactivate = async (
    employee: Employee,
  ) => {
    if (!employee.isActive || saving) return;

    const confirmed = window.confirm(
      `Deactivate "${employee.fullName}"?`,
    );

    if (!confirmed) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await request(
        `/employees/${employee.id}/deactivate`,
        {
          method: 'PATCH',
        },
      );

      setEmployees(previous =>
        previous.map(item =>
          item.id === employee.id
            ? {
                ...item,
                isActive: false,
              }
            : item,
        ),
      );

      setSuccess(
        'Employee deactivated successfully.',
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to deactivate employee.',
      );
    } finally {
      setSaving(false);
    }
  };

  // ======================================
  // SEARCH & STATISTICS
  // ======================================

  const filteredEmployees = employees.filter(
    employee => {
      const query = search.trim().toLowerCase();

      return (
        employee.fullName.toLowerCase().includes(query) ||
        employee.employeeNumber.toLowerCase().includes(query) ||
        (employee.department?.name ?? '')
          .toLowerCase()
          .includes(query) ||
        (employee.jobTitle ?? '')
          .toLowerCase()
          .includes(query)
      );
    },
  );

  const activeCount = employees.filter(
    employee => employee.isActive,
  ).length;

  const contractorCount = employees.filter(
    employee => employee.employmentType === 'CONTRACTOR',
  ).length;

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

          <h1>Employee Management</h1>

          <p>
            Manage employees, contractors,
            and department assignments.
          </p>
        </div>

        <button
          type="button"
          className="department-primary-button"
          onClick={openCreate}
          disabled={saving}
        >
          + Add Employee
        </button>

      </div>

      {/* MESSAGES */}

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

      {/* STATISTICS */}

      <div className="department-stats">

        <div className="department-stat-card">
          <span>Total Employees</span>
          <strong>{employees.length}</strong>
        </div>

        <div className="department-stat-card">
          <span>Active Records</span>
          <strong>{activeCount}</strong>
        </div>

        <div className="department-stat-card">
          <span>Contractors</span>
          <strong>{contractorCount}</strong>
        </div>

      </div>

      {/* CREATE / EDIT FORM */}

      {showForm && (

        <section className="management-card department-form-card">

          <div className="management-card-header">
            <h2>
              {editingId
                ? 'Edit Employee'
                : 'Create Employee'}
            </h2>

            <p>
              Enter the employee information below.
            </p>
          </div>

          <form onSubmit={handleSave}>

            <div className="management-form-grid">

              {/* EMPLOYEE NUMBER */}

              <div className="form-group">
                <label htmlFor="employee-number">
                  Employee Number *
                </label>

                <input
                  id="employee-number"
                  required
                  maxLength={50}
                  value={form.employeeNumber}
                  disabled={Boolean(editingId) || saving}
                  onChange={event =>
                    updateField(
                      'employeeNumber',
                      event.target.value,
                    )
                  }
                />
              </div>

              {/* FULL NAME */}

              <div className="form-group">
                <label htmlFor="employee-name">
                  Full Name *
                </label>

                <input
                  id="employee-name"
                  required
                  maxLength={200}
                  value={form.fullName}
                  disabled={saving}
                  onChange={event =>
                    updateField(
                      'fullName',
                      event.target.value,
                    )
                  }
                />
              </div>

              {/* DEPARTMENT */}

              <div className="form-group">
                <label htmlFor="employee-department">
                  Department
                </label>

                <select
                  id="employee-department"
                  value={form.departmentId}
                  disabled={saving}
                  onChange={event =>
                    updateField(
                      'departmentId',
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    No department
                  </option>

                  {departments
                    .filter(department =>
                      department.isActive ||
                      department.id === form.departmentId,
                    )
                    .map(department => (
                      <option
                        key={department.id}
                        value={department.id}
                      >
                        {department.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* EMPLOYMENT TYPE */}

              <div className="form-group">
                <label htmlFor="employment-type">
                  Employment Type
                </label>

                <select
                  id="employment-type"
                  value={form.employmentType}
                  disabled={saving}
                  onChange={event =>
                    updateField(
                      'employmentType',
                      event.target.value,
                    )
                  }
                >
                  <option value="EMPLOYEE">
                    Employee
                  </option>

                  <option value="CONTRACTOR">
                    Contractor
                  </option>
                </select>
              </div>

              {/* EMAIL */}

              <div className="form-group">
                <label htmlFor="employee-email">
                  Email
                </label>

                <input
                  id="employee-email"
                  type="email"
                  maxLength={254}
                  value={form.email}
                  disabled={saving}
                  onChange={event =>
                    updateField(
                      'email',
                      event.target.value,
                    )
                  }
                />
              </div>

              {/* PHONE */}

              <div className="form-group">
                <label htmlFor="employee-phone">
                  Phone
                </label>

                <input
                  id="employee-phone"
                  type="tel"
                  maxLength={30}
                  value={form.phone}
                  disabled={saving}
                  onChange={event =>
                    updateField(
                      'phone',
                      event.target.value,
                    )
                  }
                />
              </div>

              {/* JOB TITLE */}

              <div className="form-group">
                <label htmlFor="employee-job">
                  Job Title
                </label>

                <input
                  id="employee-job"
                  maxLength={150}
                  value={form.jobTitle}
                  disabled={saving}
                  onChange={event =>
                    updateField(
                      'jobTitle',
                      event.target.value,
                    )
                  }
                />
              </div>

              {/* HIRE DATE */}

              <div className="form-group">
                <label htmlFor="employee-hire-date">
                  Hire Date
                </label>

                <input
                  id="employee-hire-date"
                  type="date"
                  value={form.hireDate}
                  disabled={saving}
                  onChange={event =>
                    updateField(
                      'hireDate',
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
                {saving ? 'Saving...' : 'Save Employee'}
              </button>

            </div>

          </form>

        </section>
      )}

      {/* EMPLOYEE DIRECTORY */}

      <section className="management-card employee-list-card">

        <div className="department-list-header">

          <div>
            <h2>Employee Directory</h2>
            <p>
              View and manage company employee records.
            </p>
          </div>

          <input
            className="department-search"
            type="search"
            placeholder="Search employees..."
            aria-label="Search employees"
            value={search}
            onChange={event =>
              setSearch(event.target.value)
            }
          />

        </div>

        {loading ? (

          <p className="department-loading">
            Loading employees...
          </p>

        ) : (

          <div className="department-table-wrapper">

            <table className="department-table">

              <thead>
                <tr>
                  <th>Employee No.</th>
                  <th>Full Name</th>
                  <th>Department</th>
                  <th>Job Title</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>

                {filteredEmployees.map(employee => (

                  <tr key={employee.id}>

                    <td>
                      {employee.employeeNumber}
                    </td>

                    <td className="department-name">
                      {employee.fullName}
                    </td>

                    <td>
                      {employee.department?.name ?? '—'}
                    </td>

                    <td>
                      {employee.jobTitle || '—'}
                    </td>

                    <td>
                      {employee.employmentType}
                    </td>

                    <td>
                      <span
                        className={
                          employee.isActive
                            ? 'status-badge active'
                            : 'status-badge inactive'
                        }
                      >
                        {employee.isActive
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
                            !employee.isActive || saving
                          }
                          onClick={() =>
                            openEdit(employee)
                          }
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="table-deactivate-button"
                          disabled={
                            !employee.isActive || saving
                          }
                          onClick={() =>
                            deactivate(employee)
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

            {filteredEmployees.length === 0 && (
              <div className="department-empty">
                No employees found.
              </div>
            )}

          </div>
        )}

      </section>

    </main>
  );
}