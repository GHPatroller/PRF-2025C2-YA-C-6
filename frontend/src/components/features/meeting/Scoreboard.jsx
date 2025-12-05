import { useNavigate } from "react-router-dom";
import ScoreboardContent from "./ScoreboardContent";

/**
 * Página completa del Scoreboard (para la ruta /scoreboard)
 * Usa ScoreboardContent con un botón de navegación
 */
export default function ScoreboardPage() {
  const navigate = useNavigate();

  return (
    <ScoreboardContent 
      onClose={() => navigate("/")}
      showCloseButton={true}
    />
  );
}
