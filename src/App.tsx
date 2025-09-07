import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { SessionContextProvider } from "@/contexts/SessionContext";
import { Toaster } from "@/components/ui/toaster";
import MainLayout from "@/layouts/MainLayout";
import Projects from "@/pages/Projects";
import ListKoc from "@/pages/ListKoc";
import Reports from "@/pages/Reports";
import Login from "@/pages/Login";
import KocDetails from "@/pages/KocDetails";
import ProjectDetails from "@/pages/ProjectDetails";

function App() {
  return (
    <SessionContextProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<MainLayout />}>
            <Route path="/" element={<Projects />} />
            <Route path="/list-koc" element={<ListKoc />} />
            <Route path="/list-koc/:kocId" element={<KocDetails />} />
            <Route path="/projects/:projectId" element={<ProjectDetails />} />
            <Route path="/reports" element={<Reports />} />
          </Route>
        </Routes>
      </Router>
      <Toaster />
    </SessionContextProvider>
  );
}

export default App;