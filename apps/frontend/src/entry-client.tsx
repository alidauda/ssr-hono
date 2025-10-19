import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import "./index.css";

import { RouterProvider } from "react-router/dom";
import { router } from "./App";
hydrateRoot(
  document.getElementById("root") as HTMLElement,
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
