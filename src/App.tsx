import { Navigate, Route, Routes } from "react-router-dom";
import { EtfReturnsPage } from "./features/etfReturns/EtfReturnsPage";
import WatchboardPage from "./pages/WatchboardPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<WatchboardPage />} />
      <Route path="/etf-returns" element={<EtfReturnsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
