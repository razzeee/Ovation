import {
  type GraphResponse,
  fetchGraphMonth,
  fetchGraphYear,
} from "@admin/services/client";
import { Loading } from "@admin/components/helpers";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function UsageChart({ data, title }: { data: GraphResponse; title: string }) {
  const chartData = data.labels.map((label, i) => ({
    label,
    requests: data.data_requests[i],
    submitted: data.data_submitted[i],
  }));

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{title}</span>
      </div>
      <div className="card-body" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 8, bottom: 8, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-default)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{
                fill: "var(--text-tertiary)",
                fontSize: 10,
                fontFamily: "var(--font-mono)",
              }}
              axisLine={{ stroke: "var(--border-default)" }}
              tickLine={false}
              interval="preserveStartEnd"
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
            <Legend
              wrapperStyle={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
              }}
            />
            <Line
              type="monotone"
              dataKey="requests"
              name="Review Requests"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "var(--accent)" }}
            />
            <Line
              type="monotone"
              dataKey="submitted"
              name="Submitted Reviews"
              stroke="var(--danger)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "var(--danger)" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

type View = "month" | "year";

export function UsagePage() {
  const [view, setView] = useState<View>("month");
  const [monthData, setMonthData] = useState<GraphResponse | null>(null);
  const [yearData, setYearData] = useState<GraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchGraphMonth(), fetchGraphYear()])
      .then(([m, y]) => {
        setMonthData(m);
        setYearData(y);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load graphs"),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Usage Graphs</h1>
          <p className="page-subtitle">
            Review requests and submissions over time
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className={`btn ${view === "month" ? "btn-primary" : "btn-ghost"} btn-sm`}
            onClick={() => setView("month")}
          >
            Last 30 Days
          </button>
          <button
            type="button"
            className={`btn ${view === "year" ? "btn-primary" : "btn-ghost"} btn-sm`}
            onClick={() => setView("year")}
          >
            Last 12 Months
          </button>
        </div>
      </div>

      {view === "month" && monthData && (
        <div className="flex flex-col gap-4">
          <UsageChart data={monthData} title="Last 30 Days" />
        </div>
      )}

      {view === "year" && yearData && (
        <div className="flex flex-col gap-4">
          <UsageChart data={yearData} title="Last 12 Months" />
        </div>
      )}
    </>
  );
}
