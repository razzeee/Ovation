import {
  type Moderator,
  deleteModerator,
  fetchModerator,
  updateModerator,
} from "@admin/services/client";
import { useAuth } from "@admin/auth/context";
import { Loading } from "@admin/components/helpers";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

interface Props {
  /** If true, edit own profile (uses auth moderator_id). */
  self?: boolean;
}

export function ModeratorEditPage({ self }: Props) {
  const { id } = useParams<{ id: string }>();
  const { moderator: authMod, isAdmin } = useAuth();
  const navigate = useNavigate();

  const modId = self ? authMod?.moderator_id : Number(id);

  const [mod, setMod] = useState<Moderator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  // Editable fields
  const [displayName, setDisplayName] = useState("");
  const [userHash, setUserHash] = useState("");
  const [locales, setLocales] = useState("");
  const [password, setPassword] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [isAdminField, setIsAdminField] = useState(false);

  const load = useCallback(async () => {
    if (!modId) return;
    setLoading(true);
    try {
      const res = await fetchModerator(modId);
      setMod(res.moderator);
      setDisplayName(res.moderator.display_name);
      setUserHash(res.moderator.user_hash ?? "");
      setLocales(res.moderator.locales);
      setIsEnabled(res.moderator.is_enabled);
      setIsAdminField(res.moderator.is_admin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [modId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!modId) return;
    setSaving(true);
    try {
      const data: Parameters<typeof updateModerator>[1] = {
        display_name: displayName,
        user_hash: userHash || undefined,
        locales,
      };
      if (password) data.password = password;
      if (isAdmin && mod?.username !== "admin") {
        data.is_enabled = isEnabled;
        data.is_admin = isAdminField;
      }
      await updateModerator(modId, data);
      setPassword("");
      setFlash("Saved");
      setTimeout(() => setFlash(null), 3000);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!modId || !mod) return;
    if (!confirm(`Delete moderator "${mod.username}"?`)) return;
    try {
      await deleteModerator(modId);
      navigate("/moderators");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  if (loading) return <Loading />;
  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!mod) return null;

  const canEditRole = isAdmin && mod.username !== "admin";

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">
          {self ? "My Profile" : `Moderator: ${mod.username}`}
        </h1>
      </div>

      {flash && <div className="alert alert-success mb-4">{flash}</div>}

      <form onSubmit={handleSave}>
        <div className="card mb-4">
          <div className="card-body">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-4)",
              }}
            >
              <div className="form-group">
                <label className="form-label" htmlFor="me-display">
                  Display Name
                </label>
                <input
                  id="me-display"
                  className="form-input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="me-hash">
                  User Hash
                </label>
                <input
                  id="me-hash"
                  className="form-input"
                  value={userHash}
                  onChange={(e) => setUserHash(e.target.value)}
                  placeholder="Optional — links to review user"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="me-locales">
                  Languages Spoken
                </label>
                <input
                  id="me-locales"
                  className="form-input"
                  value={locales}
                  onChange={(e) => setLocales(e.target.value)}
                  required
                  placeholder="e.g. en,fr,pl or *"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="me-pass">
                  New Password
                </label>
                <input
                  id="me-pass"
                  className="form-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave empty to keep current"
                  autoComplete="new-password"
                />
              </div>

              {canEditRole && (
                <>
                  <div className="form-group">
                    <div
                      className="form-checkbox-row"
                      style={{ paddingTop: 20 }}
                    >
                      <input
                        id="me-enabled"
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) => setIsEnabled(e.target.checked)}
                      />
                      <label htmlFor="me-enabled" className="text-sm">
                        Account enabled
                      </label>
                    </div>
                  </div>
                  <div className="form-group">
                    <div
                      className="form-checkbox-row"
                      style={{ paddingTop: 20 }}
                    >
                      <input
                        id="me-admin"
                        type="checkbox"
                        checked={isAdminField}
                        onChange={(e) => setIsAdminField(e.target.checked)}
                      />
                      <label htmlFor="me-admin" className="text-sm">
                        Admin account
                      </label>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Modify"}
          </button>

          {canEditRole && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDelete}
            >
              Delete Moderator
            </button>
          )}
        </div>
      </form>
    </>
  );
}
