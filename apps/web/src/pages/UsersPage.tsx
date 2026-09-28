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

interface Role {
  id: string;
  name: string;
}

interface AvailableEmployee {
  id: string;
  employeeNumber: string;
  fullName: string;
  email: string | null;
  jobTitle: string | null;

  department: {
    id: string;
    name: string;
  } | null;
}

interface UserRecord {
  id: string;
  username: string;
  email: string;
  employeeId: string | null;
  isActive: boolean;

  role: {
    id: string;
    name: string;
    isActive: boolean;
  };

  employee: {
    id: string;
    employeeNumber: string;
    fullName: string;
    jobTitle: string | null;
    isActive: boolean;

    department: {
      id: string;
      name: string;
    } | null;
  } | null;

  _count: {
    siteAccess: number;
  };
}

interface CreateUserForm {
  employeeId: string;
  roleId: string;
  username: string;
  email: string;
  password: string;
}

const emptyCreateForm: CreateUserForm = {
  employeeId: '',
  roleId: '',
  username: '',
  email: '',
  password: '',
};

// =====================================================
// COMPONENT
// =====================================================

export default function UsersPage() {
  const {
    token,
    user,
    logout,
    hasPermission,
  } = useAuth();

  // ===================================================
  // STATE
  // ===================================================

  const [
    users,
    setUsers,
  ] =
    useState<UserRecord[]>([]);

  const [
    roles,
    setRoles,
  ] =
    useState<Role[]>([]);

  const [
    availableEmployees,
    setAvailableEmployees,
  ] =
    useState<AvailableEmployee[]>([]);

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
    search,
    setSearch,
  ] =
    useState('');

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
    showCreateForm,
    setShowCreateForm,
  ] =
    useState(false);

  const [
    createForm,
    setCreateForm,
  ] =
    useState<CreateUserForm>({
      ...emptyCreateForm,
    });

  const [
    resetUser,
    setResetUser,
  ] =
    useState<UserRecord | null>(
      null,
    );

  const [
    newPassword,
    setNewPassword,
  ] =
    useState('');

  // ===================================================
  // API HELPER
  // ===================================================

  const request =
    useCallback(
      async (
        path: string,
        options: RequestInit = {},
      ) => {
        const response =
          await fetch(
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
  // LOAD DATA
  // ===================================================

  const loadData =
    useCallback(
      async () => {
        const [
          usersResponse,
          rolesResponse,
          employeesResponse,
        ] =
          await Promise.all([
            request(
              '/users',
            ),

            request(
              '/users/roles',
            ),

            request(
              '/users/available-employees',
            ),
          ]);

        const usersData =
          (await usersResponse
            .json()) as UserRecord[];

        const rolesData =
          (await rolesResponse
            .json()) as Role[];

        const employeesData =
          (await employeesResponse
            .json()) as AvailableEmployee[];

        setUsers(
          usersData,
        );

        setRoles(
          rolesData,
        );

        setAvailableEmployees(
          employeesData,
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
    async function initialize() {
      try {
        setLoading(
          true,
        );

        setError(
          '',
        );

        await loadData();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load users.',
        );
      } finally {
        setLoading(
          false,
        );
      }
    }

    void initialize();
  }, [
    loadData,
  ]);

  // ===================================================
  // SELECT EMPLOYEE
  // ===================================================

  const selectEmployee = (
    employeeId: string,
  ) => {
    const employee =
      availableEmployees.find(
        item =>
          item.id ===
          employeeId,
      );

    setCreateForm(
      previous => ({
        ...previous,

        employeeId,

        email:
          employee?.email ??
          previous.email,
      }),
    );
  };

  // ===================================================
  // CREATE USER
  // ===================================================

  const createUser =
    async (
      event: FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      if (saving) {
        return;
      }

      if (
        !createForm.employeeId
      ) {
        setError(
          'Select an employee.',
        );

        return;
      }

      if (
        !createForm.roleId
      ) {
        setError(
          'Select a role.',
        );

        return;
      }

      if (
        !createForm.username.trim()
      ) {
        setError(
          'Username is required.',
        );

        return;
      }

      if (
        !createForm.email.trim()
      ) {
        setError(
          'Email is required.',
        );

        return;
      }

      if (
        createForm.password
          .length < 12
      ) {
        setError(
          'Password must contain at least 12 characters.',
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
          '/users',
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                employeeId:
                  createForm.employeeId,

                roleId:
                  createForm.roleId,

                username:
                  createForm.username
                    .trim()
                    .toLowerCase(),

                email:
                  createForm.email
                    .trim()
                    .toLowerCase(),

                password:
                  createForm.password,
              }),
          },
        );

        setCreateForm({
          ...emptyCreateForm,
        });

        setShowCreateForm(
          false,
        );

        await loadData();

        setSuccess(
          'User account created successfully.',
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to create user.',
        );
      } finally {
        setSaving(
          false,
        );
      }
    };

  // ===================================================
  // CHANGE ROLE
  // ===================================================

  const changeRole =
    async (
      target: UserRecord,
      roleId: string,
    ) => {
      if (
        saving ||
        roleId ===
          target.role.id
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
          `/users/${target.id}`,
          {
            method:
              'PATCH',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                roleId,
              }),
          },
        );

        await loadData();

        setSuccess(
          'User role updated successfully.',
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to update role.',
        );

        await loadData();
      } finally {
        setSaving(
          false,
        );
      }
    };

  // ===================================================
  // ACTIVATE / DEACTIVATE
  // ===================================================

  const changeStatus =
    async (
      target: UserRecord,
    ) => {
      if (saving) {
        return;
      }

      const action =
        target.isActive
          ? 'deactivate'
          : 'activate';

      const confirmed =
        window.confirm(
          `${
            target.isActive
              ? 'Deactivate'
              : 'Activate'
          } "${target.username}"?`,
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
          `/users/${target.id}/${action}`,
          {
            method:
              'PATCH',
          },
        );

        await loadData();

        setSuccess(
          target.isActive
            ? 'User deactivated successfully.'
            : 'User activated successfully.',
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to change user status.',
        );
      } finally {
        setSaving(
          false,
        );
      }
    };

  // ===================================================
  // RESET PASSWORD
  // ===================================================

  const resetPassword =
    async () => {
      if (
        !resetUser ||
        saving
      ) {
        return;
      }

      if (
        newPassword.length <
        12
      ) {
        setError(
          'Password must contain at least 12 characters.',
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
          `/users/${resetUser.id}/reset-password`,
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                newPassword,
              }),
          },
        );

        setResetUser(
          null,
        );

        setNewPassword(
          '',
        );

        setSuccess(
          'Password reset successfully.',
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to reset password.',
        );
      } finally {
        setSaving(
          false,
        );
      }
    };

  // ===================================================
  // FILTER USERS
  // ===================================================

  const filteredUsers =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        if (!query) {
          return users;
        }

        return users.filter(
          item => {
            const employeeName =
              item.employee
                ?.fullName ??
              '';

            const employeeNumber =
              item.employee
                ?.employeeNumber ??
              '';

            return (
              item.username
                .toLowerCase()
                .includes(query) ||

              item.email
                .toLowerCase()
                .includes(query) ||

              item.role.name
                .toLowerCase()
                .includes(query) ||

              employeeName
                .toLowerCase()
                .includes(query) ||

              employeeNumber
                .toLowerCase()
                .includes(query)
            );
          },
        );
      },
      [
        users,
        search,
      ],
    );

  // ===================================================
  // COUNTS
  // ===================================================

  const activeUsers =
    users.filter(
      item =>
        item.isActive,
    ).length;

  const inactiveUsers =
    users.length -
    activeUsers;

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
            SECURITY & ACCESS
          </span>

          <h1>
            User Management
          </h1>

          <p>
            Provision employee login accounts,
            manage roles and control access.
          </p>

        </div>

        {hasPermission(
          'users:create',
        ) && (
          <button
            type="button"
            className="department-primary-button"
            disabled={saving}
            onClick={() => {
              setShowCreateForm(
                previous =>
                  !previous,
              );

              setError(
                '',
              );

              setSuccess(
                '',
              );
            }}
          >
            {showCreateForm
              ? 'Close Form'
              : '+ Create User'}
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
            Total Users
          </span>

          <strong>
            {users.length}
          </strong>

        </div>

        <div className="department-stat-card">

          <span>
            Active Users
          </span>

          <strong>
            {activeUsers}
          </strong>

        </div>

        <div className="department-stat-card">

          <span>
            Inactive Users
          </span>

          <strong>
            {inactiveUsers}
          </strong>

        </div>

        <div className="department-stat-card">

          <span>
            Employees Without Accounts
          </span>

          <strong>
            {
              availableEmployees.length
            }
          </strong>

        </div>

      </div>

      {/* =============================================
          CREATE USER FORM
      ============================================== */}

      {showCreateForm &&
        hasPermission(
          'users:create',
        ) && (
          <section className="management-card department-form-card">

            <div className="management-card-header">

              <h2>
                Create User Account
              </h2>

              <p>
                Create a login account for
                an active employee.
              </p>

            </div>

            <form
              onSubmit={
                createUser
              }
            >

              <div className="management-form-grid">

                {/* EMPLOYEE */}

                <div className="form-group">

                  <label htmlFor="userEmployee">
                    Employee *
                  </label>

                  <select
                    id="userEmployee"
                    required
                    disabled={saving}
                    value={
                      createForm.employeeId
                    }
                    onChange={
                      event =>
                        selectEmployee(
                          event.target.value,
                        )
                    }
                  >

                    <option value="">
                      Select employee
                    </option>

                    {availableEmployees.map(
                      employee => (
                        <option
                          key={
                            employee.id
                          }
                          value={
                            employee.id
                          }
                        >
                          {
                            employee.employeeNumber
                          }
                          {' — '}
                          {
                            employee.fullName
                          }
                        </option>
                      ),
                    )}

                  </select>

                </div>

                {/* ROLE */}

                <div className="form-group">

                  <label htmlFor="userRole">
                    Role *
                  </label>

                  <select
                    id="userRole"
                    required
                    disabled={saving}
                    value={
                      createForm.roleId
                    }
                    onChange={
                      event =>
                        setCreateForm(
                          previous => ({
                            ...previous,

                            roleId:
                              event.target.value,
                          }),
                        )
                    }
                  >

                    <option value="">
                      Select role
                    </option>

                    {roles.map(
                      role => (
                        <option
                          key={
                            role.id
                          }
                          value={
                            role.id
                          }
                        >
                          {
                            role.name
                          }
                        </option>
                      ),
                    )}

                  </select>

                </div>

                {/* USERNAME */}

                <div className="form-group">

                  <label htmlFor="username">
                    Username *
                  </label>

                  <input
                    id="username"
                    required
                    maxLength={100}
                    disabled={saving}
                    value={
                      createForm.username
                    }
                    onChange={
                      event =>
                        setCreateForm(
                          previous => ({
                            ...previous,

                            username:
                              event.target.value,
                          }),
                        )
                    }
                  />

                </div>

                {/* EMAIL */}

                <div className="form-group">

                  <label htmlFor="userEmail">
                    Email *
                  </label>

                  <input
                    id="userEmail"
                    type="email"
                    required
                    maxLength={254}
                    disabled={saving}
                    value={
                      createForm.email
                    }
                    onChange={
                      event =>
                        setCreateForm(
                          previous => ({
                            ...previous,

                            email:
                              event.target.value,
                          }),
                        )
                    }
                  />

                </div>

                {/* PASSWORD */}

                <div className="form-group form-full-width">

                  <label htmlFor="initialPassword">
                    Initial Password *
                  </label>

                  <input
                    id="initialPassword"
                    type="password"
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    disabled={saving}
                    value={
                      createForm.password
                    }
                    onChange={
                      event =>
                        setCreateForm(
                          previous => ({
                            ...previous,

                            password:
                              event.target.value,
                          }),
                        )
                    }
                  />

                  <small>
                    Minimum 12 characters.
                  </small>

                </div>

              </div>

              <div className="department-form-actions">

                <button
                  type="button"
                  className="department-secondary-button"
                  disabled={saving}
                  onClick={() => {
                    setCreateForm({
                      ...emptyCreateForm,
                    });

                    setShowCreateForm(
                      false,
                    );
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="department-primary-button"
                  disabled={saving}
                >
                  {saving
                    ? 'Creating...'
                    : 'Create User'}
                </button>

              </div>

            </form>

          </section>
        )}

      {/* =============================================
          USER TABLE
      ============================================== */}

      <section className="management-card user-list-card">

        <div className="department-list-header">

          <div>

            <h2>
              System Users
            </h2>

            <p>
              Manage roles and account status.
            </p>

          </div>

          <input
            type="search"
            className="department-search"
            placeholder="Search users..."
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
            Loading users...
          </p>
        ) : (
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
                    Department
                  </th>

                  <th>
                    Role
                  </th>

                  <th>
                    Sites
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

                {filteredUsers.map(
                  item => (
                    <tr
                      key={
                        item.id
                      }
                    >

                      {/* USER */}

                      <td>

                        <strong>
                          {
                            item.username
                          }
                        </strong>

                        <div className="user-email-text">
                          {
                            item.email
                          }
                        </div>

                      </td>

                      {/* EMPLOYEE */}

                      <td>
                        {item.employee
                          ?.fullName ??
                          'Not linked'}
                      </td>

                      {/* DEPARTMENT */}

                      <td>
                        {item.employee
                          ?.department
                          ?.name ??
                          '—'}
                      </td>

                      {/* ROLE */}

                      <td>

                        <select
                          value={
                            item.role.id
                          }
                          disabled={
                            saving ||
                            item.id ===
                              user?.id ||
                            !hasPermission(
                              'users:update',
                            )
                          }
                          onChange={
                            event =>
                              void changeRole(
                                item,
                                event.target.value,
                              )
                          }
                        >

                          {roles.map(
                            role => (
                              <option
                                key={
                                  role.id
                                }
                                value={
                                  role.id
                                }
                              >
                                {
                                  role.name
                                }
                              </option>
                            ),
                          )}

                        </select>

                      </td>

                      {/* SITES */}

                      <td>
                        {
                          item._count
                            .siteAccess
                        }
                      </td>

                      {/* STATUS */}

                      <td>

                        <span
                          className={
                            item.isActive
                              ? 'status-badge active'
                              : 'status-badge inactive'
                          }
                        >
                          {item.isActive
                            ? 'Active'
                            : 'Inactive'}
                        </span>

                      </td>

                      {/* ACTIONS */}

                      <td>

                        <div className="department-actions">

                          {/* RESET PASSWORD */}

                          {hasPermission(
                            'users:reset-password',
                          ) && (
                            <button
                              type="button"
                              className="table-edit-button"
                              disabled={saving}
                              onClick={() => {
                                setResetUser(
                                  item,
                                );

                                setNewPassword(
                                  '',
                                );

                                setError(
                                  '',
                                );

                                setSuccess(
                                  '',
                                );
                              }}
                            >
                              Reset Password
                            </button>
                          )}

                          {/* DEACTIVATE */}

                          {item.isActive &&
                            hasPermission(
                              'users:deactivate',
                            ) && (
                              <button
                                type="button"
                                className="table-deactivate-button"
                                disabled={
                                  saving ||
                                  item.id ===
                                    user?.id
                                }
                                onClick={
                                  () =>
                                    void changeStatus(
                                      item,
                                    )
                                }
                              >
                                Deactivate
                              </button>
                            )}

                          {/* ACTIVATE */}

                          {!item.isActive &&
                            hasPermission(
                              'users:activate',
                            ) && (
                              <button
                                type="button"
                                className="table-edit-button"
                                disabled={saving}
                                onClick={
                                  () =>
                                    void changeStatus(
                                      item,
                                    )
                                }
                              >
                                Activate
                              </button>
                            )}

                        </div>

                      </td>

                    </tr>
                  ),
                )}

              </tbody>

            </table>

            {filteredUsers.length ===
              0 && (
              <div className="department-empty">
                No users found.
              </div>
            )}

          </div>
        )}

      </section>

      {/* =============================================
          RESET PASSWORD PANEL
      ============================================== */}

      {resetUser &&
        hasPermission(
          'users:reset-password',
        ) && (
          <section className="management-card password-reset-card">

            <div className="management-card-header">

              <div>

                <h2>
                  Reset Password
                </h2>

                <p>
                  Set a new password for{' '}
                  <strong>
                    {
                      resetUser.username
                    }
                  </strong>.
                </p>

              </div>

            </div>

            <div className="form-group">

              <label htmlFor="newPassword">
                New Password *
              </label>

              <input
                id="newPassword"
                type="password"
                minLength={12}
                maxLength={128}
                required
                autoComplete="new-password"
                disabled={saving}
                value={
                  newPassword
                }
                onChange={
                  event =>
                    setNewPassword(
                      event.target.value,
                    )
                }
              />

              <small>
                Minimum 12 characters.
              </small>

            </div>

            <div className="department-form-actions">

              <button
                type="button"
                className="department-secondary-button"
                disabled={saving}
                onClick={() => {
                  setResetUser(
                    null,
                  );

                  setNewPassword(
                    '',
                  );

                  setError(
                    '',
                  );
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                className="department-primary-button"
                disabled={
                  saving ||
                  newPassword.length <
                    12
                }
                onClick={
                  () =>
                    void resetPassword()
                }
              >
                {saving
                  ? 'Resetting...'
                  : 'Reset Password'}
              </button>

            </div>

          </section>
        )}

    </main>
  );
}