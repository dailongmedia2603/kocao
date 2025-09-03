import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import ProjectsList from "./pages/ProjectsList";
import ProjectDetail from "./pages/ProjectDetail";
import { SessionContextProvider } from "./contexts/SessionContext";
import { Toaster } from "sonner";

function App() {
  return (
    <BrowserRouter>
      <SessionContextProvider>
        <Toaster richColors position="top-right" />
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<ProjectsList />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
          </Route>
          {/* Assuming you have Login and other auth routes, keep them here */}
        </Routes>
      </SessionContextProvider>
    </BrowserRouter>
  );
}

export default App;