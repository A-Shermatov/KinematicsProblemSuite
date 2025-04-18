import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Register from "../components/Register";
import Login from "../components/Login";
import Main from "../components/Main";
import "./App.css";
import Themes from "../components/Themes";
import Tasks from "../components/Tasks";

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/main" element={<Main />} />
        <Route path="/" element={<Main />} />
        <Route path="/themes" element={<Themes />} />
        <Route path="/themes/:themeId/tasks" element={<Tasks />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
