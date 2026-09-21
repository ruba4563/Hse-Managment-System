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

// -----------------------------------------
// Types
// -----------------------------------------

interface Company {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
}

interface CompanyForm {
  name: string;
  address: string;
  phone: string;
  email: string;
}

// -----------------------------------------
// Component
// -----------------------------------------

export default function CompanyPage() {
  const { token } = useAuth();

  const [company, setCompany] =
    useState<Company | null>(null);

  const [form, setForm] =
    useState<CompanyForm>({
      name: '',
      address: '',
      phone: '',
      email: '',
    });

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  // -------------------------------------
  // Load company information
  // -------------------------------------

  useEffect(() => {
    if (!token) {
      return;
    }

    const controller = new AbortController();

    async function loadCompany() {
      try {
        setLoading(true);
        setError('');

        const response = await fetch(
          `${API_URL}/companies/me`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(
            await getErrorMessage(response),
          );
        }

        const data =
          (await response.json()) as Company;

        if (controller.signal.aborted) {
          return;
        }

        setCompany(data);

        setForm({
          name: data.name,
          address: data.address ?? '',
          phone: data.phone ?? '',
          email: data.email ?? '',
        });
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load company.',
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadCompany();

    return () => {
      controller.abort();
    };
  }, [token]);

  // -------------------------------------
  // Update form fields
  // -------------------------------------

  const updateField = (
    field: keyof CompanyForm,
    value: string,
  ) => {
    setForm(previous => ({
      ...previous,
      [field]: value,
    }));

    setError('');
    setSuccess('');
  };

  // -------------------------------------
  // Save company
  // -------------------------------------

  const handleSave = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!token || saving) {
      return;
    }

    if (!form.name.trim()) {
      setError('Company name is required.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(
        `${API_URL}/companies/me`,
        {
          method: 'PATCH',

          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            name: form.name.trim(),
            address: form.address.trim(),
            phone: form.phone.trim(),
            email: form.email.trim(),
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response),
        );
      }

      const updatedCompany =
        (await response.json()) as Company;

      setCompany(updatedCompany);

      setForm({
        name: updatedCompany.name,
        address: updatedCompany.address ?? '',
        phone: updatedCompany.phone ?? '',
        email: updatedCompany.email ?? '',
      });

      setSuccess(
        'Company information updated successfully.',
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update company.',
      );
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------
  // Loading state
  // -------------------------------------

  if (loading) {
    return (
      <div className="management-page">
        <p>Loading company information...</p>
      </div>
    );
  }

  // -------------------------------------
  // Error state
  // -------------------------------------

  if (!company) {
    return (
      <div className="management-page">
        <div role="alert" className="error-message">
          {error || 'Company not found.'}
        </div>
      </div>
    );
  }

  // -------------------------------------
  // Page
  // -------------------------------------

  return (
    <main className="management-page">

      <div className="management-heading">
        <div>
          <span className="management-eyebrow">
            ORGANIZATION
          </span>

          <h1>Company Management</h1>

          <p>
            View and update your company
            information.
          </p>
        </div>

        <span className="company-code">
          {company.code}
        </span>
      </div>

      <div className="management-card">

        <div className="management-card-header">
          <h2>Company Information</h2>

          <p>
            Update the organization's
            basic contact details.
          </p>
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

        <form onSubmit={handleSave}>

          <div className="management-form-grid">

            <div className="form-group">
              <label htmlFor="company-name">
                Company Name *
              </label>

              <input
                id="company-name"
                type="text"
                maxLength={200}
                required
                value={form.name}
                onChange={event =>
                  updateField(
                    'name',
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor="company-code">
                Company Code
              </label>

              <input
                id="company-code"
                type="text"
                value={company.code}
                disabled
              />
            </div>

            <div className="form-group">
              <label htmlFor="company-email">
                Email
              </label>

              <input
                id="company-email"
                type="email"
                maxLength={254}
                value={form.email}
                onChange={event =>
                  updateField(
                    'email',
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor="company-phone">
                Phone
              </label>

              <input
                id="company-phone"
                type="tel"
                maxLength={30}
                value={form.phone}
                onChange={event =>
                  updateField(
                    'phone',
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="form-group form-full-width">
              <label htmlFor="company-address">
                Address
              </label>

              <input
                id="company-address"
                type="text"
                maxLength={500}
                value={form.address}
                onChange={event =>
                  updateField(
                    'address',
                    event.target.value,
                  )
                }
              />
            </div>

          </div>

          <div className="management-actions">

            <button
              type="submit"
              className="login-button management-save"
              disabled={saving}
            >
              {saving
                ? 'Saving...'
                : 'Save Changes'}
            </button>

          </div>

        </form>

      </div>

    </main>
  );
}