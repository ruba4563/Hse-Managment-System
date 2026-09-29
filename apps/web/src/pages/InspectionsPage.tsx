import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { API_URL, getErrorMessage } from "../lib/api";

interface TemplateItem {
  id: string;
  itemText: string;
  sectionName: string | null;
  isMandatory: boolean;
  isActive: boolean;
  displayOrder: number;
}
interface InspectionType {
  id: string;
  name: string;
  category: string;
  isActive: boolean;
  templateItems: TemplateItem[];
}
interface ChecklistResponse {
  id: string;
  result: string | null;
  comments: string | null;
  templateItem: TemplateItem;
}
interface Finding {
  id: string;
  title: string;
  description: string;
  severity: string;
  findingType: string;
  isClosed: boolean;
  recommendedAction: string | null;
}
interface Inspection {
  id: string;
  inspectionNumber: string;
  title: string;
  description: string | null;
  status: string;
  scheduledAt: string | null;
  rejectionReason: string | null;
  inspectionType: InspectionType;
  site: { id: string; name: string };
  inspector: { id: string; username: string };
  checklistResponses?: ChecklistResponse[];
  findings?: Finding[];
}
interface Options {
  sites: {
    id: string;
    name: string;
    projectId: string;
    project: { name: string };
  }[];
  inspectors: {
    id: string;
    username: string;
    role: { name: string };
    siteAccess: { siteId: string }[];
  }[];
}
interface HistoryItem {
  id: string;
  action: string;
  createdAt: string;
  user: { username: string } | null;
  newValues: { comments?: string; closureComments?: string };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="form-group">
      <span>{label}</span>
      {children}
    </label>
  );
}

function localDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export default function InspectionsPage() {
  const { token, hasPermission, logout } = useAuth();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [types, setTypes] = useState<InspectionType[]>([]);
  const [options, setOptions] = useState<Options>({
    sites: [],
    inspectors: [],
  });
  const [selected, setSelected] = useState<Inspection | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [siteId, setSiteId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const detailRequest = useRef(0);
  const can = (action: string) => hasPermission(`inspections:${action}`);

  const request = useCallback(
    async <T,>(path: string, method = "GET", body?: unknown): Promise<T> => {
      const response = await fetch(`${API_URL}/inspections${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body !== undefined && { "Content-Type": "application/json" }),
        },
        ...(body !== undefined && { body: JSON.stringify(body) }),
      });
      if (response.status === 401) logout();
      if (!response.ok) throw new Error(await getErrorMessage(response));
      return response.json() as Promise<T>;
    },
    [token, logout],
  );

  const load = useCallback(async () => {
    const [records, definitions, choices] = await Promise.all([
      request<Inspection[]>(""),
      request<InspectionType[]>("/types"),
      request<Options>("/options"),
    ]);
    return { records, definitions, choices };
  }, [request]);

  useEffect(() => {
    let active = true;
    void load()
      .then((data) => {
        if (active) {
          setInspections(data.records);
          setTypes(data.definitions);
          setOptions(data.choices);
        }
      })
      .catch((err) => {
        if (active)
          setError(
            err instanceof Error ? err.message : "Unable to load inspections",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      detailRequest.current += 1;
    };
  }, [load]);

  async function openDetails(id: string) {
    const sequence = ++detailRequest.current;
    setBusy(true);
    setError("");
    try {
      const [record, events] = await Promise.all([
        request<Inspection>(`/${id}`),
        request<HistoryItem[]>(`/${id}/history`),
      ]);
      if (sequence === detailRequest.current) {
        setSelected(record);
        setHistory(events);
      }
    } catch (err) {
      if (sequence === detailRequest.current)
        setError(
          err instanceof Error ? err.message : "Unable to load inspection",
        );
    } finally {
      if (sequence === detailRequest.current) setBusy(false);
    }
  }

  async function save(
    path: string,
    method: string,
    body?: unknown,
    refreshId?: string,
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request(path, method, body);
      const data = await load();
      setInspections(data.records);
      setTypes(data.definitions);
      setOptions(data.choices);
      if (refreshId) {
        const [record, events] = await Promise.all([
          request<Inspection>(`/${refreshId}`),
          request<HistoryItem[]>(`/${refreshId}/history`),
        ]);
        setSelected(record);
        setHistory(events);
      }
      setMessage("Changes saved.");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save changes");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function formValues(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    return Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    ) as Record<string, string>;
  }

  const visible = inspections.filter(
    (item) =>
      (!status || item.status === status) &&
      `${item.title} ${item.inspectionNumber} ${item.site.name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const selectedType = types.find((type) => type.id === typeId);

  return (
    <main className="management-page">
      <div className="management-heading">
        <div>
          <span className="management-eyebrow">HSE OPERATIONS</span>
          <h2>Inspection Management</h2>
          <p>Schedule inspections, complete checklists and review findings.</p>
        </div>
        <div className="department-actions">
          {can("create") && (
            <button
              className="department-primary-button"
              onClick={() => setShowCreate(!showCreate)}
            >
              New inspection
            </button>
          )}
          {can("manage-templates") && (
            <button
              className="department-secondary-button"
              onClick={() => setShowTemplates(!showTemplates)}
            >
              Manage templates
            </button>
          )}
        </div>
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success-message" role="status">
          {message}
        </p>
      )}

      {showCreate && can("create") && (
        <section className="management-card department-form-card">
          <h3>New inspection</h3>
          <form
            onSubmit={async (event) => {
              const values = formValues(event);
              const site = options.sites.find(
                (item) => item.id === values.siteId,
              );
              if (!site) return;
              const saved = await save("", "POST", {
                ...values,
                projectId: site.projectId,
                scheduledAt: values.scheduledAt
                  ? new Date(values.scheduledAt).toISOString()
                  : undefined,
              });
              if (saved) setShowCreate(false);
            }}
          >
            <fieldset disabled={busy} className="inspection-fieldset">
              <div className="management-form-grid">
                <Field label="Title">
                  <input name="title" required minLength={3} maxLength={250} />
                </Field>
                <Field label="Inspection type">
                  <select name="inspectionTypeId" required defaultValue="">
                    <option value="" disabled>
                      Select type
                    </option>
                    {types
                      .filter((type) => type.isActive)
                      .map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Project / site">
                  <select
                    name="siteId"
                    required
                    value={siteId}
                    onChange={(event) => setSiteId(event.target.value)}
                  >
                    <option value="" disabled>
                      Select site
                    </option>
                    {options.sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.project.name} / {site.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Inspector">
                  <select
                    key={siteId}
                    name="inspectorId"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select inspector
                    </option>
                    {options.inspectors
                      .filter(
                        (user) =>
                          user.role.name === "SUPER_ADMIN" ||
                          user.siteAccess.some(
                            (access) => access.siteId === siteId,
                          ),
                      )
                      .map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.username}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Scheduled date and time">
                  <input name="scheduledAt" type="datetime-local" />
                </Field>
                <Field label="Description / equipment or vehicle reference">
                  <textarea name="description" maxLength={5000} />
                </Field>
              </div>
              <button className="department-primary-button">
                Create draft
              </button>
            </fieldset>
          </form>
        </section>
      )}

      {showTemplates && can("manage-templates") && (
        <section className="management-card department-form-card">
          <h3>Inspection templates</h3>
          <p>
            Used questions are preserved. Retire a question and add its
            replacement for future inspections.
          </p>
          <details>
            <summary>Create inspection type</summary>
            <form
              onSubmit={async (event) => {
                const form = event.currentTarget;
                if (await save("/types", "POST", formValues(event)))
                  form.reset();
              }}
            >
              <fieldset
                disabled={busy}
                className="inspection-fieldset management-form-grid"
              >
                <Field label="Name">
                  <input name="name" required minLength={3} maxLength={150} />
                </Field>
                <Field label="Code">
                  <input
                    name="code"
                    required
                    pattern="[A-Z0-9][A-Z0-9\-]{1,49}"
                    placeholder="SITE-WEEKLY"
                  />
                </Field>
                <Field label="Category">
                  <select name="category">
                    <option>SITE</option>
                    <option>EQUIPMENT</option>
                    <option>VEHICLE</option>
                  </select>
                </Field>
                <button className="department-primary-button">
                  Create type
                </button>
              </fieldset>
            </form>
          </details>
          <Field label="Template">
            <select
              value={typeId}
              onChange={(event) => setTypeId(event.target.value)}
            >
              <option value="">Select template</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </Field>
          {selectedType && (
            <>
              <ul>
                {selectedType.templateItems.map((item) => (
                  <li key={item.id}>
                    {item.itemText}{" "}
                    {item.isMandatory ? "(required)" : "(optional)"}{" "}
                    {!item.isActive ? (
                      "— retired"
                    ) : (
                      <button
                        disabled={busy}
                        className="department-secondary-button"
                        onClick={() =>
                          void save(
                            `/types/${typeId}/items/${item.id}/retire`,
                            "POST",
                          )
                        }
                      >
                        Retire
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <form
                onSubmit={async (event) => {
                  const form = event.currentTarget;
                  const values = formValues(event);
                  if (
                    await save(`/types/${typeId}/items`, "POST", {
                      ...values,
                      displayOrder: Number(values.displayOrder),
                      isMandatory: values.isMandatory === "true",
                    })
                  )
                    form.reset();
                }}
              >
                <fieldset
                  disabled={busy}
                  className="inspection-fieldset management-form-grid"
                >
                  <Field label="Checklist question">
                    <input
                      name="itemText"
                      required
                      minLength={3}
                      maxLength={1000}
                    />
                  </Field>
                  <Field label="Section">
                    <input name="sectionName" maxLength={150} />
                  </Field>
                  <Field label="Order">
                    <input
                      name="displayOrder"
                      type="number"
                      defaultValue="0"
                      min="0"
                      max="10000"
                      required
                    />
                  </Field>
                  <Field label="Required">
                    <select name="isMandatory">
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </Field>
                  <button className="department-primary-button">
                    Add question
                  </button>
                </fieldset>
              </form>
            </>
          )}
        </section>
      )}

      <section className="management-card">
        <div className="department-list-header">
          <h3>Inspections ({visible.length})</h3>
          <div className="department-actions">
            <input
              aria-label="Search inspections"
              className="department-search"
              placeholder="Search title, number or site"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              aria-label="Filter by status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              {[
                "DRAFT",
                "SCHEDULED",
                "IN_PROGRESS",
                "SUBMITTED",
                "APPROVED",
                "REJECTED",
                "CLOSED",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </div>
        </div>
        {loading ? (
          <p>Loading inspections…</p>
        ) : (
          <div className="department-table-wrapper">
            <table className="department-table">
              <thead>
                <tr>
                  <th>Inspection</th>
                  <th>Type / site</th>
                  <th>Inspector</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.title}
                      <div className="user-email-text">
                        {item.inspectionNumber}
                      </div>
                    </td>
                    <td>
                      {item.inspectionType.name}
                      <br />
                      {item.site.name}
                    </td>
                    <td>{item.inspector.username}</td>
                    <td>{item.status}</td>
                    <td>
                      <button
                        disabled={busy}
                        className="department-secondary-button"
                        onClick={() => void openDetails(item.id)}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
                {!visible.length && (
                  <tr>
                    <td colSpan={5}>No inspections found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <section
          className="management-card department-form-card"
          aria-label="Inspection details"
        >
          <div className="management-card-header">
            <h3>
              {selected.title} — {selected.status}
            </h3>
            <button
              disabled={busy}
              className="department-secondary-button"
              onClick={() => {
                detailRequest.current += 1;
                setSelected(null);
              }}
            >
              Close details
            </button>
          </div>
          <p>{selected.description}</p>
          {selected.rejectionReason && (
            <p className="error-message">
              Rejection reason: {selected.rejectionReason}
            </p>
          )}
          {can("update") &&
            ["DRAFT", "SCHEDULED", "REJECTED"].includes(selected.status) && (
              <form
                key={`${selected.id}-${selected.status}`}
                onSubmit={(event) => {
                  const values = formValues(event);
                  void save(
                    `/${selected.id}`,
                    "PATCH",
                    {
                      ...values,
                      scheduledAt: values.scheduledAt
                        ? new Date(values.scheduledAt).toISOString()
                        : undefined,
                    },
                    selected.id,
                  );
                }}
              >
                <fieldset
                  disabled={busy}
                  className="inspection-fieldset management-form-grid"
                >
                  <Field label="Title">
                    <input
                      name="title"
                      required
                      minLength={3}
                      maxLength={250}
                      defaultValue={selected.title}
                    />
                  </Field>
                  <Field label="Scheduled date and time">
                    <input
                      name="scheduledAt"
                      type="datetime-local"
                      defaultValue={localDate(selected.scheduledAt)}
                    />
                  </Field>
                  <Field label="Description">
                    <textarea
                      name="description"
                      maxLength={5000}
                      defaultValue={selected.description ?? ""}
                    />
                  </Field>
                  <button className="department-primary-button">
                    Save details
                  </button>
                </fieldset>
              </form>
            )}

          <div className="department-actions">
            {can("update") && selected.status === "DRAFT" && (
              <button
                disabled={busy}
                onClick={() =>
                  void save(
                    `/${selected.id}/schedule`,
                    "POST",
                    undefined,
                    selected.id,
                  )
                }
              >
                Schedule
              </button>
            )}
            {can("update") &&
              ["DRAFT", "SCHEDULED", "REJECTED"].includes(selected.status) && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void save(
                      `/${selected.id}/start`,
                      "POST",
                      undefined,
                      selected.id,
                    )
                  }
                >
                  {selected.status === "REJECTED"
                    ? "Resume inspection"
                    : "Start inspection"}
                </button>
              )}
            {can("submit") && selected.status === "IN_PROGRESS" && (
              <button
                disabled={busy}
                onClick={() =>
                  void save(
                    `/${selected.id}/submit`,
                    "POST",
                    undefined,
                    selected.id,
                  )
                }
              >
                Submit for review
              </button>
            )}
            {can("close") && selected.status === "APPROVED" && (
              <button
                disabled={busy}
                onClick={() =>
                  void save(
                    `/${selected.id}/close`,
                    "POST",
                    undefined,
                    selected.id,
                  )
                }
              >
                Close inspection
              </button>
            )}
          </div>

          <h4>Checklist</h4>
          {selected.checklistResponses?.map((response) => (
            <form
              key={`${response.id}-${response.result}-${response.comments}`}
              className="inspection-checklist-row"
              onSubmit={(event) => {
                void save(
                  `/${selected.id}/checklist/${response.id}`,
                  "PATCH",
                  formValues(event),
                  selected.id,
                );
              }}
            >
              <fieldset
                disabled={
                  busy || selected.status !== "IN_PROGRESS" || !can("update")
                }
                className="inspection-fieldset management-form-grid"
              >
                <Field
                  label={`${response.templateItem.itemText}${response.templateItem.isMandatory ? " (required)" : ""}`}
                >
                  <select
                    name="result"
                    defaultValue={response.result ?? ""}
                    required
                  >
                    <option value="" disabled>
                      Not answered
                    </option>
                    <option>PASS</option>
                    <option>FAIL</option>
                    <option>NOT_APPLICABLE</option>
                  </select>
                </Field>
                <Field label="Comments (required for not applicable)">
                  <input
                    name="comments"
                    defaultValue={response.comments ?? ""}
                    maxLength={2000}
                  />
                </Field>
                {can("update") && selected.status === "IN_PROGRESS" && (
                  <button className="department-secondary-button">
                    Save answer
                  </button>
                )}
              </fieldset>
            </form>
          ))}

          <h4>Findings</h4>
          {!selected.findings?.length && <p>No findings recorded.</p>}
          {selected.findings?.map((finding) => (
            <div key={finding.id} className="inspection-checklist-row">
              <strong>
                {finding.title} — {finding.severity} —{" "}
                {finding.isClosed ? "Closed" : "Open"}
              </strong>
              <p>{finding.description}</p>
              <p>{finding.recommendedAction}</p>
              {!finding.isClosed &&
                can("close") &&
                selected.status === "APPROVED" && (
                  <form
                    onSubmit={(event) =>
                      void save(
                        `/${selected.id}/findings/${finding.id}/close`,
                        "POST",
                        formValues(event),
                        selected.id,
                      )
                    }
                  >
                    <fieldset disabled={busy} className="inspection-fieldset">
                      <Field label="Closure explanation">
                        <input name="comments" required maxLength={2000} />
                      </Field>
                      <button className="department-secondary-button">
                        Close finding
                      </button>
                    </fieldset>
                  </form>
                )}
            </div>
          ))}
          {can("manage-findings") && selected.status === "IN_PROGRESS" && (
            <details>
              <summary>Record finding</summary>
              <form
                onSubmit={async (event) => {
                  const form = event.currentTarget;
                  const values = formValues(event);
                  if (
                    await save(
                      `/${selected.id}/findings`,
                      "POST",
                      {
                        ...values,
                        checklistResponseId:
                          values.checklistResponseId || undefined,
                      },
                      selected.id,
                    )
                  )
                    form.reset();
                }}
              >
                <fieldset
                  disabled={busy}
                  className="inspection-fieldset management-form-grid"
                >
                  <Field label="Title">
                    <input
                      name="title"
                      required
                      minLength={3}
                      maxLength={250}
                    />
                  </Field>
                  <Field label="Description">
                    <textarea
                      name="description"
                      required
                      minLength={3}
                      maxLength={5000}
                    />
                  </Field>
                  <Field label="Type">
                    <select name="findingType">
                      {[
                        "DEFECT",
                        "OBSERVATION",
                        "UNSAFE_ACT",
                        "UNSAFE_CONDITION",
                      ].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Severity">
                    <select name="severity">
                      {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Related checklist answer">
                    <select name="checklistResponseId">
                      <option value="">Standalone finding</option>
                      {selected.checklistResponses?.map((response) => (
                        <option key={response.id} value={response.id}>
                          {response.templateItem.itemText} (
                          {response.result ?? "unanswered"})
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Recommended action">
                    <textarea name="recommendedAction" maxLength={2000} />
                  </Field>
                  <Field label="Location">
                    <input name="location" maxLength={500} />
                  </Field>
                  <button className="department-primary-button">
                    Record finding
                  </button>
                </fieldset>
              </form>
            </details>
          )}

          {can("approve") && selected.status === "SUBMITTED" && (
            <form
              onSubmit={(event) => {
                const values = formValues(event);
                void save(
                  `/${selected.id}/${values.decision}`,
                  "POST",
                  { comments: values.comments },
                  selected.id,
                );
              }}
            >
              <fieldset
                disabled={busy}
                className="inspection-fieldset management-form-grid"
              >
                <Field label="Review decision">
                  <select name="decision">
                    <option value="approve">Approve</option>
                    <option value="reject">Reject</option>
                  </select>
                </Field>
                <Field label="Review comments (required for rejection)">
                  <textarea name="comments" maxLength={2000} />
                </Field>
                <button className="department-primary-button">
                  Save review
                </button>
              </fieldset>
            </form>
          )}
          <h4>History</h4>
          <ul>
            {history.map((item) => (
              <li key={item.id}>
                {new Date(item.createdAt).toLocaleString()} — {item.action} —{" "}
                {item.user?.username ?? "System"}
                {item.newValues?.comments && `: ${item.newValues.comments}`}
                {item.newValues?.closureComments &&
                  `: ${item.newValues.closureComments}`}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
