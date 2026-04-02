import {
  type Moderator,
  addModerator,
  deleteModerator,
  fetchModerators,
} from "@admin/services/client";
import { EmptyState, Loading } from "@admin/components/helpers";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

export function ModeratorsPage() {
  const [mods, setMods] = useState<Moderator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchModerators();
      setMods(res.moderators);
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
      await addModerator({
        username,
        password,
        display_name: displayName,
      });
      setUsername("");
      setPassword("");
      setDisplayName("");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete moderator "${name}"? This cannot be undone.`)) return;
    try {
      await deleteModerator(id);
      setMods((prev) => prev.filter((m) => m.moderator_id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Moderators</h1>
        <p className="page-subtitle">{mods.length} moderators</p>
      </div>

      <div className="card mb-4">
        {loading ? (
          <Loading />
        ) : error ? (
          <div className="alert alert-danger" style={{ margin: "1rem" }}>
            {error}
          </div>
        ) : mods.length === 0 ? (
          <EmptyState title="No moderators" />
        ) : (
          <div className="card-body-flush table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Display Name</th>
                  <th>Enabled</th>
                  <th>Admin</th>
                  <th>User Hash</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mods.map((m) => (
                  <tr key={m.moderator_id}>
                    <td className="td-mono">{m.moderator_id}</td>
                    <td className="td-mono">
                      <Link to={`/moderators/${m.moderator_id}`}>
                        {m.username}
                      </Link>
                    </td>
                    <td>{m.display_name}</td>
                    <td>
                      {m.is_enabled ? (
                        <span className="badge badge-success">Yes</span>
                      ) : (
                        <span className="badge badge-danger">No</span>
                      )}
                    </td>
                    <td>
                      {m.is_admin ? (
                        <span className="badge badge-info">Yes</span>
                      ) : (
                        <span className="badge badge-neutral">No</span>
                      )}
                    </td>
                    <td className="td-mono td-muted">{m.user_id ?? "-"}</td>
                    <td style={{ textAlign: "right" }}>
                      <Link
                        to={`/moderators/${m.moderator_id}`}
                        className="btn btn-ghost btn-sm"
                      >
                        Edit
                      </Link>
                      {m.username !== "admin" && (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          style={{ marginLeft: 4 }}
                          onClick={() =>
                            handleDelete(m.moderator_id, m.username)
                          }
                        >
                          Delete
                        </button>
                      )}
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
          <span className="card-title">Add Moderator</span>
        </div>
        <div className="card-body">
          <form onSubmit={handleAdd} className="form-inline">
            <div className="form-group">
              <label className="form-label" htmlFor="mod-user">
                Username
              </label>
              <input
                id="mod-user"
                className="form-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="mod-pass">
                Password
              </label>
              <input
                id="mod-pass"
                className="form-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="mod-display">
                Display Name
              </label>
              <input
                id="mod-display"
                className="form-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
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
