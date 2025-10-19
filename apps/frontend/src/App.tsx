import "./App.css";
import { Suspense, lazy } from "react";
import reactLogo from "./assets/react.svg";
import { createBrowserRouter, useLoaderData, Link } from "react-router";
import type { RouteObject } from "react-router";

// Works also with SSR as expected
const Card = lazy(() => import("./Card"));

// Example loader function that fetches data
async function homeLoader() {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 100));
  return {
    message: "Data loaded from loader!",
    timestamp: new Date().toISOString(),
  };
}

// Example loader for about page
async function aboutLoader() {
  return {
    title: "About Page",
    description: "This page uses React Router data mode with SSR",
  };
}

function App() {
  const data = useLoaderData() as Awaited<ReturnType<typeof homeLoader>>;

  return (
    <main>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src="/vite.svg" className="logo" alt="Vite logo" />
        </a>
        <a href="https://reactjs.org" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React with Data Mode</h1>

      <nav style={{ margin: "1rem 0" }}>
        <Link to="/" style={{ marginRight: "1rem" }}>
          Home
        </Link>
        <Link to="/about">About</Link>
      </nav>

      <div
        style={{
          padding: "1rem",
          background: "#1a1a1a",
          borderRadius: "8px",
          margin: "1rem 0",
        }}
      >
        <h3>Loader Data:</h3>
        <p>{data.message}</p>
        <p>Loaded at: {data.timestamp}</p>
      </div>

      <Suspense fallback={<p>Loading card component...</p>}>
        <Card />
      </Suspense>

      <p className="read-the-docs">
        Click on the Vite and React logos to learn more hello
      </p>
    </main>
  );
}

function About() {
  const data = useLoaderData() as Awaited<ReturnType<typeof aboutLoader>>;

  return (
    <main>
      <h1>{data.title}</h1>
      <p>{data.description}</p>
      <nav style={{ margin: "1rem 0" }}>
        <Link to="/">Back to Home</Link>
      </nav>
    </main>
  );
}

// Export routes configuration with Suspense boundaries
export const routes: RouteObject[] = [
  {
    path: "/",
    element: (
      <Suspense fallback={<div>Loading page...</div>}>
        <App />
      </Suspense>
    ),
    loader: homeLoader,
  },
  {
    path: "/about",
    element: (
      <Suspense fallback={<div>Loading about page...</div>}>
        <About />
      </Suspense>
    ),
    loader: aboutLoader,
  },
];

// Create browser router for client-side
export const router = createBrowserRouter(routes);
