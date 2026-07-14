import { BrowserRouter, Routes, Route } from "react-router-dom";

import Dashboard from "../pages/Dashboard/Dashboard";
import Weather from "../pages/Weather/Weather";
import River from "../pages/River/River";
import Prediction from "../pages/Prediction/Prediction";
import Statistics from "../pages/Statistics/Statistics";
import Pipeline from "../pages/Pipeline/Pipeline";
import About from "../pages/About/About";
import NotFound from "../pages/NotFound/NotFound";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/weather" element={<Weather />} />
        <Route path="/river" element={<River />} />
        <Route path="/prediction" element={<Prediction />} />
        <Route path="/statistics" element={<Statistics />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;