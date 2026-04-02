import {
  type ReviewDetail,
  type ReviewDetailResponse,
  anonifyReview,
  banUser,
  deleteReview,
  englishifyReview,
  fetchReview,
  modifyReview,
  unremoveReview,
  unreportReview,
  voteReview,
} from "@admin/services/client";
import { useAuth } from "@admin/auth/context";
import { Loading, Stars, formatDate } from "@admin/components/helpers";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

export function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const reviewId = Number(id);

  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [voteExists, setVoteExists] = useState<number | null>(null);
  const [matchedTaboos, setMatchedTaboos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  // Editable fields
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [version, setVersion] = useState("");
  const [distro, setDistro] = useState("");
  const [locale, setLocale] = useState("");
  const [userDisplay, setUserDisplay] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchReview(reviewId);
      setReview(res.review);
      setVoteExists(res.vote_exists);
      setMatchedTaboos(res.matched_taboos);
      setSummary(res.review.summary);
      setDescription(res.review.description);
      setVersion(res.review.version);
      setDistro(res.review.distro);
      setLocale(res.review.locale);
      setUserDisplay(res.review.user_display);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load review");
    } finally {
      setLoading(false);
    }
  }, [reviewId]);

  useEffect(() => {
    load();
  }, [load]);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 3000);
  };

  const handleModify = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await modifyReview(reviewId, {
        summary,
        description,
        version,
        distro,
        locale,
        user_display: userDisplay,
      });
      showFlash("Review updated");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (
    action: () => Promise<unknown>,
    successMsg: string,
  ) => {
    try {
      await action();
      showFlash(successMsg);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Permanently delete this review? This cannot be undone."))
      return;
    try {
      await deleteReview(reviewId);
      navigate("/reviews");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleBan = async () => {
    if (!review) return;
    if (
      !confirm("Ban user and delete ALL their reviews? This cannot be undone.")
    )
      return;
    try {
      const res = await banUser(review.user_hash);
      showFlash(`User banned. ${res.msg}`);
      navigate("/reviews");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ban failed");
    }
  };

  if (loading) return <Loading />;
  if (error)
    return (
      <div className="alert alert-danger" style={{ margin: "1rem" }}>
        {error}
      </div>
    );
  if (!review) return null;

  return (
    <>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">{review.app_id}</h1>
          <p className="page-subtitle">Review #{review.review_id}</p>
        </div>
        <Link
          to={`/reviews/app/${encodeURIComponent(review.app_id)}`}
          className="btn btn-ghost btn-sm"
        >
          All reviews for this app
        </Link>
      </div>

      {/* Flash message */}
      {flash && <div className="alert alert-success mb-4">{flash}</div>}

      {/* Taboo warnings */}
      {matchedTaboos.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {matchedTaboos.map((word) => (
            <div key={word} className="alert alert-warning">
              Contains taboo word: <strong>{word}</strong>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleModify}>
        <div className="card mb-4">
          <div className="card-body-flush">
            <div className="detail-grid">
              {/* Rating (read-only) */}
              <div className="detail-row">
                <div className="detail-key">Rating</div>
                <div className="detail-value">
                  <Stars rating={review.rating} />
                  <span
                    className="text-xs text-muted"
                    style={{ marginLeft: 8 }}
                  >
                    +{review.karma_up} / -{review.karma_down}
                  </span>
                </div>
                <div className="detail-actions">
                  {voteExists === null && (
                    <>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          handleAction(
                            () => voteReview(reviewId, "up"),
                            "Voted up",
                          )
                        }
                      >
                        Vote Up
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          handleAction(
                            () => voteReview(reviewId, "down"),
                            "Voted down",
                          )
                        }
                      >
                        Vote Down
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Reported */}
              {review.reported > 0 && (
                <div className="detail-row">
                  <div className="detail-key">Reported</div>
                  <div className="detail-value">
                    <span className="badge badge-danger">
                      {review.reported} report(s)
                    </span>
                  </div>
                  <div className="detail-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        handleAction(
                          () => unreportReview(reviewId),
                          "Unreported",
                        )
                      }
                    >
                      Unreport
                    </button>
                  </div>
                </div>
              )}

              {/* Created / Deleted */}
              <div className="detail-row">
                <div className="detail-key">Created</div>
                <div className="detail-value">
                  {formatDate(review.date_created)}
                  {review.date_deleted && (
                    <span
                      className="badge badge-danger"
                      style={{ marginLeft: 8 }}
                    >
                      deleted {formatDate(review.date_deleted)}
                    </span>
                  )}
                </div>
                <div className="detail-actions">
                  {review.date_deleted && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        handleAction(() => unremoveReview(reviewId), "Restored")
                      }
                    >
                      Unremove
                    </button>
                  )}
                </div>
              </div>

              {/* User Display */}
              <div className="detail-row">
                <div className="detail-key">User</div>
                <div className="detail-value" style={{ flex: 1 }}>
                  <input
                    className="form-input"
                    value={userDisplay}
                    onChange={(e) => setUserDisplay(e.target.value)}
                    style={{ maxWidth: 280 }}
                  />
                </div>
                <div className="detail-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      handleAction(() => anonifyReview(reviewId), "Anonymised")
                    }
                  >
                    Anonify
                  </button>
                  <Link
                    to={`/reviews/user/${encodeURIComponent(review.user_hash)}`}
                    className="btn btn-ghost btn-sm"
                  >
                    Show All
                  </Link>
                </div>
              </div>

              {/* Locale */}
              <div className="detail-row">
                <div className="detail-key">Locale</div>
                <div className="detail-value">
                  <input
                    className="form-input"
                    value={locale}
                    onChange={(e) => setLocale(e.target.value)}
                    style={{ maxWidth: 180 }}
                  />
                </div>
                <div className="detail-actions">
                  <Link
                    to={`/reviews/locale/${encodeURIComponent(review.locale)}`}
                    className="btn btn-ghost btn-sm"
                  >
                    All
                  </Link>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      handleAction(
                        () => englishifyReview(reviewId),
                        "Set to English",
                      )
                    }
                  >
                    Englishify
                  </button>
                </div>
              </div>

              {/* Version */}
              <div className="detail-row">
                <div className="detail-key">Version</div>
                <div className="detail-value">
                  <input
                    className="form-input"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    style={{ maxWidth: 180 }}
                  />
                </div>
                <div className="detail-actions" />
              </div>

              {/* Distro */}
              <div className="detail-row">
                <div className="detail-key">Distro</div>
                <div className="detail-value">
                  <input
                    className="form-input"
                    value={distro}
                    onChange={(e) => setDistro(e.target.value)}
                    style={{ maxWidth: 280 }}
                  />
                </div>
                <div className="detail-actions" />
              </div>

              {/* Summary */}
              <div className="detail-row">
                <div className="detail-key">Summary</div>
                <div className="detail-value" style={{ gridColumn: "2 / 4" }}>
                  <input
                    className="form-input"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="detail-row">
                <div className="detail-key">Description</div>
                <div className="detail-value" style={{ gridColumn: "2 / 4" }}>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-between gap-4">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Modify"}
          </button>

          <div className="flex gap-2">
            {isAdmin && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleBan}
              >
                Ban User &amp; Delete Reviews
              </button>
            )}
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDelete}
            >
              Remove Forever
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
