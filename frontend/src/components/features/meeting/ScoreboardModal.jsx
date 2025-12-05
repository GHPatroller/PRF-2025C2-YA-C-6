import { useEffect, useRef } from "react";
import ScoreboardContent from "./ScoreboardContent";

export default function ScoreboardModal({ onClose }) {
  const modalRef = useRef(null);

  // Cerrar con ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // Cerrar al hacer clic fuera del modal
  const handleBackdropClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20,
      }}
    >
      <div
        ref={modalRef}
        style={{
          backgroundColor: "#f5f5f5",
          borderRadius: 12,
          maxWidth: 1000,
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
        }}
      >
        {/* Reutilizamos el componente ScoreboardContent con props para el modal */}
        <ScoreboardContent 
          onClose={onClose}
          showCloseButton={true}
          containerStyle={{ padding: 16 }}
        />
      </div>
    </div>
  );
}

