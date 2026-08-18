import { BrowserRouter, Routes, Route } from "react-router-dom";

import Layout from "../components/layout/Layout";

import Dashboard from "../pages/Dashboard/Dashboard";
import Weather from "../pages/Weather/Weather";
import River from "../pages/River/River";
import Prediction from "../pages/Prediction/Prediction";
import Statistics from "../pages/Statistics/Statistics";
import Pipeline from "../pages/Pipeline/Pipeline";
import MLDashboard from "../pages/MLDashboard/MLDashboard";
import MLOps from "../pages/MLOps/MLOps";
import About from "../pages/About/About";
import NotFound from "../pages/NotFound/NotFound";
import Register from "../pages/Auth/Register";
import Login from "../pages/Auth/Login";
import Account from "../pages/Account/Account";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/weather" element={<Weather />} />
          <Route path="/river" element={<River />} />
          <Route path="/prediction" element={<Prediction />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/ml-dashboard" element={<MLDashboard />} />
          <Route path="/mlops" element={<MLOps />} />
          <Route path="/about" element={<About />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/account" element={<Account />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;