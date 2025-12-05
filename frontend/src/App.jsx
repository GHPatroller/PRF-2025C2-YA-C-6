import { HashRouter, Routes, Route } from "react-router-dom";
import ZoomMeeting from "./ZoomMeeting";
import ScoreboardPage from "./components/features/meeting/Scoreboard";
import { useIframeMessaging } from "./hooks/useIframeMessaging";

export default function App() {
  useIframeMessaging();

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ZoomMeeting />} />
        <Route path="/scoreboard" element={<ScoreboardPage />} />
      </Routes>
    </HashRouter>
  );
}