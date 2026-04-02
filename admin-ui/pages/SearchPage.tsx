import { type ReviewSummary, searchReviews } from "@admin/services/client";
import {
  EmptyState,
  Loading,
  Stars,
  truncate,
} from "@admin/components/helpers";
import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";

export function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReviewSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await searchReviews(query.trim());
      setResults(res.reviews);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Search Reviews</h1>
        <p className="page-subtitle">
          Search by user name, summary, or description
        </p>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <form onSubmit={handleSearch} className="form-inline">
            <div className="form-group" style={{ flex: 3 }}>
              <label className="form-label" htmlFor="search-q">
                Query
              </label>
              <input
                id="search-q"
                className="form-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter search term..."
                required
                // biome-ignore lint/a11y/noAutofocus: intentional UX for search page
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </form>
        </div>
      </div>

      {error && <div className="alert alert-danger mb-4">{error}</div>}

      {results !== null && (
        <div className="card">
          {results.length === 0 ? (
            <EmptyState
              title="No results"
              subtitle="Try a different search term"
            />
          ) : (
            <div className="card-body-flush table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Application</th>
                    <th>Rating</th>
                    <th>Locale</th>
                    <th>User</th>
                    <th>Summary</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.review_id}>
                      <td className="td-mono">{truncate(r.app_id, 35)}</td>
                      <td>
                        <Stars rating={r.rating} />
                        {r.reported > 0 && (
                          <span
                            className="badge badge-danger"
                            style={{ marginLeft: 6 }}
                          >
                            {r.reported}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-neutral">{r.locale}</span>
                      </td>
                      <td className="td-truncate">
                        {r.user_display || (
                          <span className="td-muted">Unknown</span>
                        )}
                      </td>
                      <td className="td-truncate">{truncate(r.summary, 30)}</td>
                      <td style={{ textAlign: "right" }}>
                        <Link
                          to={`/reviews/${r.review_id}`}
                          className="btn btn-ghost btn-sm"
                        >
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
