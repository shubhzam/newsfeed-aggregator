"use client";

import { useEffect, useState } from "react";

type HealthResponse = {
  status: "ok" | "degraded";
  checks: {
    database: boolean;
    redis: boolean;
  };
};

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("http://localhost:4000/health")
      .then((res) => res.json())
      .then((data: HealthResponse) => setHealth(data))
      .catch(() => setError("Could not reach the API"));
  }, []);

  return (
    <main style={{ padding: "2rem", fontFamily: "monospace" }}>
      <h1>newsfeed-aggregator</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {!error && !health && <p>Checking API health...</p>}
      {health && (
        <div>
          <p>
            Overall:{" "}
            <strong style={{ color: health.status === "ok" ? "green" : "orange" }}>
              {health.status}
            </strong>
          </p>
          <p>Database: {health.checks.database ? "✅" : "❌"}</p>
          <p>Redis: {health.checks.redis ? "✅" : "❌"}</p>
        </div>
      )}
    </main>
  );
}