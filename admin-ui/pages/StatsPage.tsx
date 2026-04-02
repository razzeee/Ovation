import { type StatsResponse, fetchStats } from "@admin/services/client";
import { Loading, formatNum, stripDesktop } from "@admin/components/helpers";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function StatsPage() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats()
      .then(setData)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load stats"),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!data) return null;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Statistics</h1>
      </div>

      {/* Stats grid */}
      <div className="stat-grid mb-4">
        {Object.entries(data.stats).map(([label, value]) => (
          <div key={label} className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-value">{formatNum(value)}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--space-4)",
        }}
      >
        {/* Popularity by page view */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Most Viewed (Top 50)</span>
          </div>
          <div
            className="card-body-flush table-wrap"
            style={{ maxHeight: 400, overflowY: "auto" }}
          >
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Application</th>
                  <th style={{ textAlign: "right" }}>Fetches</th>
                </tr>
              </thead>
              <tbody>
                {data.popularity_viewed.map((item, i) => (
                  <tr key={item.app_id}>
                    <td className="td-mono td-muted">{i + 1}</td>
                    <td className="td-mono">{stripDesktop(item.app_id)}</td>
                    <td className="td-mono text-right">
                      {formatNum(item.fetch_cnt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Popularity by submissions */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Most Reviewed (Top 50)</span>
          </div>
          <div
            className="card-body-flush table-wrap"
            style={{ maxHeight: 400, overflowY: "auto" }}
          >
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Application</th>
                  <th style={{ textAlign: "right" }}>Reviews</th>
                </tr>
              </thead>
              <tbody>
                {data.popularity_submitted.map((item, i) => (
                  <tr key={item.app_id}>
                    <td className="td-mono td-muted">{i + 1}</td>
                    <td className="td-mono">
                      <Link
                        to={`/reviews/app/${encodeURIComponent(item.app_id)}`}
                      >
                        {stripDesktop(item.app_id)}
                      </Link>
                    </td>
                    <td className="td-mono text-right">
                      {formatNum(item.review_cnt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--space-4)",
        }}
        className="mt-4"
      >
        {/* Awesome users */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Most Awesome Users</span>
          </div>
          <div className="card-body-flush table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Karma</th>
                  <th>Hash</th>
                </tr>
              </thead>
              <tbody>
                {data.users_awesome.map((u) => (
                  <tr key={u.user_id}>
                    <td className="td-mono">{u.user_id}</td>
                    <td>
                      <span className="badge badge-success">
                        {formatNum(u.karma)}
                      </span>
                    </td>
                    <td className="td-mono">
                      <Link
                        to={`/reviews/user/${encodeURIComponent(u.user_hash)}`}
                      >
                        {u.user_hash.slice(0, 12)}...
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Haters */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Haters Gonna Hate</span>
          </div>
          <div className="card-body-flush table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Karma</th>
                  <th>Hash</th>
                </tr>
              </thead>
              <tbody>
                {data.users_haters.map((u) => (
                  <tr key={u.user_id}>
                    <td className="td-mono">{u.user_id}</td>
                    <td>
                      <span className="badge badge-danger">
                        {formatNum(u.karma)}
                      </span>
                    </td>
                    <td className="td-mono">
                      <Link
                        to={`/reviews/user/${encodeURIComponent(u.user_hash)}`}
                      >
                        {u.user_hash.slice(0, 12)}...
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Distro chart */}
      <div className="card mt-4">
        <div className="card-header">
          <span className="card-title">Where Reviews Come From</span>
        </div>
        <div className="card-body" style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.distros}
              margin={{ top: 8, right: 8, bottom: 8, left: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border-default)"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{
                  fill: "var(--text-tertiary)",
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                }}
                axisLine={{ stroke: "var(--border-default)" }}
                tickLine={false}
              />
              <YAxis
                tick={{
                  fill: "var(--text-tertiary)",
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
