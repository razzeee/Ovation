import {
  type ReviewSummary,
  type ReviewsListResponse,
  deleteReview,
  fetchReviews,
  fetchReviewsByApp,
  fetchReviewsByLocale,
  fetchReviewsByUser,
  searchReviews,
} from "@admin/services/client";
import {
  EmptyState,
  Loading,
  Stars,
  formatDate,
  paginationRange,
  truncate,
} from "@admin/components/helpers";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

interface Props {
  filter?: "reported";
  mode?: "by-app" | "by-locale" | "by-user";
}

export function ReviewsPage({ filter, mode }: Props) {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const perPage = 25;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let res: ReviewsListResponse;

      if (mode === "by-app" && params.appId) {
        res = await fetchReviewsByApp(params.appId);
      } else if (mode === "by-locale" && params.locale) {
        res = await fetchReviewsByLocale(params.locale);
      } else if (mode === "by-user" && params.userHash) {
        res = await fetchReviewsByUser(params.userHash);
      } else {
        res = await fetchReviews({ page, per_page: perPage, filter });
      }

      setReviews(res.reviews);
      setTotal(res.pagination?.total ?? res.reviews.length);
      setTotalPages(
        res.pagination ? Math.ceil(res.pagination.total / perPage) : 1,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, [page, filter, mode, params.appId, params.locale, params.userHash]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePageChange = (p: number) => {
    setPage(p);
    setSearchParams({ page: String(p) });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Permanently delete this review?")) return;
    try {
      await deleteReview(id);
      setReviews((prev) => prev.filter((r) => r.review_id !== id));
      setTotal((prev) => prev - 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  // Page title
  let title = "All Reviews";
  let subtitle = `${total} reviews total`;
  if (filter === "reported") {
    title = "Reported Reviews";
    subtitle = `${total} reported reviews`;
  } else if (mode === "by-app") {
    title = `Reviews for ${params.appId}`;
  } else if (mode === "by-locale") {
    title = `Reviews in ${params.locale}`;
  } else if (mode === "by-user") {
    title = "Reviews by user";
    subtitle = params.userHash ?? "";
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>

      <div className="card">
        {loading ? (
          <Loading />
        ) : error ? (
          <div className="alert alert-danger" style={{ margin: "1rem" }}>
            {error}
          </div>
        ) : reviews.length === 0 ? (
          <EmptyState title="No reviews found" />
        ) : (
          <>
            <div className="card-body-flush table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Application</th>
                    <th>Ver</th>
                    <th>Rating</th>
                    <th>Locale</th>
                    <th>User</th>
                    <th>Summary</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((r) => (
                    <tr key={r.review_id}>
                      <td className="td-mono">
                        <Link
                          to={`/reviews/app/${encodeURIComponent(r.app_id)}`}
                        >
                          {truncate(r.app_id, 35)}
                        </Link>
                      </td>
                      <td className="td-mono td-muted">{r.version || "-"}</td>
                      <td>
                        <Stars rating={r.rating} />
                        {(r.karma_up > 0 || r.karma_down > 0) && (
                          <span
                            className="text-xs text-muted"
                            style={{ marginLeft: 6 }}
                          >
                            +{r.karma_up}/-{r.karma_down}
                          </span>
                        )}
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
                        <Link
                          to={`/reviews/locale/${encodeURIComponent(r.locale)}`}
                          className="badge badge-neutral"
                        >
                          {r.locale}
                        </Link>
                      </td>
                      <td className="td-truncate">
                        {r.user_display ? (
                          truncate(r.user_display, 15)
                        ) : (
                          <span className="td-muted">Unknown</span>
                        )}
                      </td>
                      <td className="td-truncate">
                        <span>{truncate(r.summary, 30)}</span>
                        {r.description && (
                          <span
                            className="td-muted"
                            style={{ display: "block" }}
                          >
                            {truncate(r.description, 40)}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <Link
                          to={`/reviews/${r.review_id}`}
                          className="btn btn-ghost btn-sm"
                        >
                          Details
                        </Link>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          style={{ marginLeft: 4 }}
                          onClick={() => handleDelete(r.review_id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination — only for all/reported views */}
            {!mode && totalPages > 1 && (
              <div className="pagination">
                <button
                  type="button"
                  className="pagination-btn"
                  disabled={page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                >
                  &laquo;
                </button>
                {paginationRange(page, totalPages).map((p, i) =>
                  p === "..." ? (
                    // biome-ignore lint/suspicious/noArrayIndexKey: ellipsis items have no stable key
                    <span key={`e${i}`} className="pagination-ellipsis">
                      ...
                    </span>
                  ) : (
                    <button
                      type="button"
                      key={p}
                      className="pagination-btn"
                      data-active={p === page || undefined}
                      onClick={() => handlePageChange(p)}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  className="pagination-btn"
                  disabled={page >= totalPages}
                  onClick={() => handlePageChange(page + 1)}
                >
                  &raquo;
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
