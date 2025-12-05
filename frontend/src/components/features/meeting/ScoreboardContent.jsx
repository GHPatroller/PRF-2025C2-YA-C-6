import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Componente reutilizable que contiene la lógica y UI del Scoreboard
 * Puede ser usado tanto en una página completa como en un modal
 */
export default function ScoreboardContent({ 
  onClose, 
  showCloseButton = false,
  containerStyle = {} 
}) {
  const [data, setData] = useState(() => {
    try {
      const raw = localStorage.getItem("scoreboard");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const boardRef = useRef(null);

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

    const id = setInterval(read, 5000);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("scoreboard-updated", onCustom);
      clearInterval(id);
    };
  }, []);

  const nowLabel = useMemo(() => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  }, []);

  const handleDownloadPDF = async () => {
    const element = boardRef.current;
    if (!element) return;

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      windowWidth: element.scrollWidth,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pageWidth;
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    let heightLeft = pdfHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
    }

    pdf.save("scoreboard.pdf");
  };

  const YELLOW = "#f39c12";
  const RED = "#e74c3c";

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto", ...containerStyle }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        {showCloseButton && onClose && (
          <button
            onClick={onClose}
            style={{
              backgroundColor: "#28a745",
              color: "white",
              padding: "10px 20px",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: 14,
            }}
          >
            ✕ Cerrar
          </button>
        )}

        <button
          onClick={handleDownloadPDF}
          style={{
            backgroundColor: "#007bff",
            color: "white",
            padding: "8px 16px",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          📄 Descargar PDF
        </button>

        <button
          onClick={() => window.print()}
          style={{
            backgroundColor: "#6c757d",
            color: "white",
            padding: "8px 16px",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          🖨️ Imprimir
        </button>

        {showCloseButton && (
          <div style={{ marginLeft: "auto", fontSize: 12, color: "#666", alignSelf: "center" }}>
            Presiona ESC para cerrar
          </div>
        )}
      </div>

      {/* Contenido del scoreboard */}
      <div
        ref={boardRef}
        style={{
          background: "white",
          padding: 16,
          borderRadius: 8,
          boxShadow: "0 0 10px rgba(0,0,0,0.08)",
        }}
      >
        <header style={{ marginBottom: 12 }}>
          <h1 style={{ textAlign: "center", margin: 0 }}>Scoreboard</h1>
          <p style={{ textAlign: "center", opacity: 0.7, marginTop: 6 }}>
            Generado: {nowLabel}
          </p>
        </header>

        {!data || data.length === 0 ? (
          <p style={{ textAlign: "center", opacity: 0.7 }}>
            Aún no hay datos para mostrar.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th
                  style={{
                    borderBottom: "1px solid #ddd",
                    textAlign: "left",
                    padding: 8,
                  }}
                >
                  Usuario
                </th>
                <th
                  style={{
                    borderBottom: "1px solid #ddd",
                    textAlign: "left",
                    padding: 8,
                    color: YELLOW,
                  }}
                >
                  Tarjetas Amarillas
                </th>
                <th
                  style={{
                    borderBottom: "1px solid #ddd",
                    textAlign: "left",
                    padding: 8,
                    color: RED,
                  }}
                >
                  Tarjetas Rojas
                </th>
                <th
                  style={{
                    borderBottom: "1px solid #ddd",
                    textAlign: "left",
                    padding: 8,
                  }}
                >
                  Estado
                </th>
                <th
                  style={{
                    borderBottom: "1px solid #ddd",
                    textAlign: "left",
                    padding: 8,
                  }}
                >
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
    </div>
  );
}

