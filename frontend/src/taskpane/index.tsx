import * as React from "react";
import { createRoot } from "react-dom/client";
import Taskpane from "./Taskpane";

/* global Office */

Office.onReady(() => {
  const container = document.getElementById("root");
  if (!container) throw new Error("Root container not found");
  createRoot(container).render(<Taskpane />);
});
