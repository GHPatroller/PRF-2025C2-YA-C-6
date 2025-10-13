import { useEffect, useState } from "react";

export default function ScoreboardPage() {
  const [data, setData] = useState(() => {
    try {
      const raw = localStorage.getItem("scoreboard");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem("scoreboard");
        setData(raw ? JSON.parse(raw) : []);
      } catch {}
    };

    const onStorage = (e) => {
      if (e.key === "scoreboard") read();
    };
    window.addEventListener("storage", onStorage);

    const onCustom = () => read();
    window.addEventListener("scoreboard-updated", onCustom);

    const id = setInterval(read, 5000); // fallback

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("scoreboard-updated", onCustom);
      clearInterval(id);
    };
  }, []);

  const YELLOW = "#f39c12";
  const RED = "#e74c3c";

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ textAlign: "center" }}>Scoreboard</h1>

      {!data || data.length === 0 ? (
        <p style={{ textAlign: "center", opacity: 0.7 }}>
          Aún no hay datos para mostrar.
        </p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>
                Usuario
              </th>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8, color: YELLOW }}>
                Tarjetas Amarillas
              </th>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8, color: RED }}>
                Tarjetas Rojas
              </th>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>
                Estado
              </th>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>
                Último evento
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={row.id ?? row.userId ?? i}>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                  {row.displayName ?? row.name ?? row.userId ?? row.id}
                </td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                  {row.yellows ?? row.yellow ?? 0}
                </td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                  {row.red ? 1 : 0}
                </td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                  {row.status ?? "—"}
                </td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                  {row.lastEvent ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
