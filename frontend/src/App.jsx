import { BrowserRouter, Routes, Route } from "react-router-dom";
import ZoomMeeting from "./ZoomMeeting";
import ScoreboardPage from "./components/features/meeting/Scoreboard";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ZoomMeeting />} />
        <Route path="/scoreboard" element={<ScoreboardPage />} />
      </Routes>
    </BrowserRouter>
  );
}