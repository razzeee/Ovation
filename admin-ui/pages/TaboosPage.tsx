import {
  type Taboo,
  addTaboo,
  deleteTaboo,
  fetchTaboos,
} from "@admin/services/client";
import { EmptyState, Loading } from "@admin/components/helpers";
import { type FormEvent, useCallback, useEffect, useState } from "react";

export function TaboosPage() {
  const [taboos, setTaboos] = useState<Taboo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form
  const [locale, setLocale] = useState("");
  const [value, setValue] = useState("");
  const [severity, setSeverity] = useState(0);
  const [description, setDescription] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchTaboos();
      setTaboos(res.taboos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      await addTaboo({ locale, value, severity, description });
      setLocale("");
      setValue("");
      setSeverity(0);
      setDescription("");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: number, val: string) => {
    if (!confirm(`Delete taboo "${val}"?`)) return;
    try {
      await deleteTaboo(id);
      setTaboos((prev) => prev.filter((t) => t.taboo_id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const severityClass = (s: number) => {
    if (s >= 3) return "badge-danger";
    if (s >= 2) return "badge-warning";
    if (s >= 1) return "badge-info";
    return "badge-neutral";
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Taboo Words</h1>
        <p className="page-subtitle">{taboos.length} taboo entries</p>
      </div>

      <div className="card mb-4">
        {loading ? (
          <Loading />
        ) : error ? (
          <div className="alert alert-danger" style={{ margin: "1rem" }}>
            {error}
          </div>
        ) : taboos.length === 0 ? (
          <EmptyState title="No taboos defined" />
        ) : (
          <div
            className="card-body-flush table-wrap"
            style={{ maxHeight: 500, overflowY: "auto" }}
          >
            <table>
              <thead>
                <tr>
                  <th>Locale</th>
                  <th>Value</th>
                  <th>Severity</th>
                  <th>Description</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {taboos.map((t) => (
                  <tr key={t.taboo_id}>
                    <td className="td-mono">{t.locale}</td>
                    <td className="td-mono" style={{ fontWeight: 600 }}>
                      {t.value}
                    </td>
                    <td>
                      <span className={`badge ${severityClass(t.severity)}`}>
                        {t.severity}
                      </span>
                    </td>
                    <td>{t.description}</td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(t.taboo_id, t.value)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add form */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Add Taboo</span>
        </div>
        <div className="card-body">
          <form onSubmit={handleAdd} className="form-inline">
            <div className="form-group" style={{ maxWidth: 100 }}>
              <label className="form-label" htmlFor="tab-locale">
                Locale
              </label>
              <input
                id="tab-locale"
                className="form-input"
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                placeholder="en"
                required
              />
            </div>
            <div className="form-group" style={{ maxWidth: 160 }}>
              <label className="form-label" htmlFor="tab-value">
                Value
              </label>
              <input
                id="tab-value"
                className="form-input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{ maxWidth: 80 }}>
              <label className="form-label" htmlFor="tab-severity">
                Severity
              </label>
              <input
                id="tab-severity"
                className="form-input"
                type="number"
                min={0}
                max={3}
                value={severity}
                onChange={(e) => setSeverity(Number(e.target.value))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="tab-desc">
                Description
              </label>
              <input
                id="tab-desc"
                className="form-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={adding}>
              {adding ? "Adding..." : "Add"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
