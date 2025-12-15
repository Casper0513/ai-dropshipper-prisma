import ReactDOM from "react-dom/client";
import DashboardApp from "./Dashboard.jsx";
import React from "react";
import "./dashboard.css";

export default function App() {

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<DashboardApp />);
