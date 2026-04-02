import {
  type AppComponent,
  deleteComponent,
  fetchComponents,
  joinComponents,
} from "@admin/services/client";
import { EmptyState, Loading, formatNum } from "@admin/components/helpers";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

export function ComponentsPage() {
  const [components, setComponents] = useState<AppComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // Join selection state
  const [parentId, setParentId] = useState<number | null>(null);
  const [childIds, setChildIds] = useState<Set<number>>(new Set());
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchComponents();
      setComponents(res.components);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 3000);
  };

  const handleJoin = async () => {
    if (!parentId || childIds.size === 0) {
      alert("Select a parent (P) and at least one child (C)");
      return;
    }
    setJoining(true);
    try {
      // Resolve app_ids for the selected component IDs
      const parentComp = components.find((c) => c.component_id === parentId);
      const childComps = components.filter((c) => childIds.has(c.component_id));
      if (!parentComp) return;
      await joinComponents({
        parent: parentComp.app_id,
        children: childComps.map((c) => c.app_id),
      });
      setParentId(null);
      setChildIds(new Set());
      showFlash("Components joined");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Join failed");
    } finally {
      setJoining(false);
    }
  };

  const handleDelete = async (id: number, appId: string) => {
    if (
      !confirm(
        `Delete component "${appId}" and all its reviews? This cannot be undone.`,
      )
    )
      return;
    try {
      await deleteComponent(id);
      setComponents((prev) => prev.filter((c) => c.component_id !== id));
      showFlash("Component deleted");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const toggleChild = (id: number) => {
    setChildIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Components</h1>
          <p className="page-subtitle">{components.length} components</p>
        </div>
        {(parentId || childIds.size > 0) && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleJoin}
            disabled={joining}
          >
            {joining
              ? "Joining..."
              : `Join (${childIds.size} children -> parent)`}
          </button>
        )}
      </div>

      {flash && <div className="alert alert-success mb-4">{flash}</div>}

      <div className="card">
        {loading ? (
          <Loading />
        ) : error ? (
          <div className="alert alert-danger" style={{ margin: "1rem" }}>
            {error}
          </div>
        ) : components.length === 0 ? (
          <EmptyState title="No components" />
        ) : (
          <div
            className="card-body-flush table-wrap"
            style={{ maxHeight: 600, overflowY: "auto" }}
          >
            <table>
              <thead>
                <tr>
                  <th>AppStream ID</th>
                  <th>Parent</th>
                  <th style={{ textAlign: "right" }}>Reviews</th>
                  <th style={{ textAlign: "right" }}>Fetches</th>
                  <th title="Parent" style={{ textAlign: "center" }}>
                    P
                  </th>
                  <th title="Child" style={{ textAlign: "center" }}>
                    C
                  </th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {components.map((c) => {
                  const hasParent = c.component_id_parent !== null;
                  return (
                    <tr key={c.component_id}>
                      <td
                        className="td-mono"
                        style={{ opacity: hasParent ? 0.5 : 1 }}
                      >
                        {c.app_id}
                      </td>
                      <td className="td-mono td-muted">
                        {c.component_id_parent ?? "None"}
                      </td>
                      <td className="td-mono text-right">
                        <Link
                          to={`/reviews/app/${encodeURIComponent(c.app_id)}`}
                        >
                          {formatNum(c.review_cnt)}
                        </Link>
                      </td>
                      <td className="td-mono text-right">
                        {formatNum(c.fetch_cnt)}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="radio"
                          name="join-parent"
                          checked={parentId === c.component_id}
                          onChange={() => setParentId(c.component_id)}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={childIds.has(c.component_id)}
                          onChange={() => toggleChild(c.component_id)}
                        />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(c.component_id, c.app_id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
