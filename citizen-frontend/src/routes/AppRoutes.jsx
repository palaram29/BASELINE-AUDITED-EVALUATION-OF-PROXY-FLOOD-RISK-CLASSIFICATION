import { BrowserRouter, Routes, Route } from "react-router-dom";

import Layout from "../components/Layout";
import RequireAuth from "../components/RequireAuth";

import Home from "../pages/Home";
import Weather from "../pages/Weather";
import Rivers from "../pages/Rivers";
import Forecast from "../pages/Forecast";
import MapPage from "../pages/MapPage";
import Notifications from "../pages/Notifications";
import Login from "../pages/Login";
import Register from "../pages/Register";
import Account from "../pages/Account";
import NotFound from "../pages/NotFound";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/weather" element={<Weather />} />
          <Route path="/rivers" element={<Rivers />} />
          <Route path="/forecast" element={<Forecast />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/alerts"
            element={
              <RequireAuth>
                <Notifications />
              </RequireAuth>
            }
          />
          <Route
            path="/account"
            element={
              <RequireAuth>
                <Account />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
