import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import About from "./pages/About";
import ListKoc from "./pages/ListKoc";
import KocDetail from "./pages/KocDetail";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Reports from "./pages/Reports";
import { Toaster } from "@/components/ui/toaster";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/about" element={<About />} />
        <Route path="/list-koc" element={<ListKoc />} />
        <Route path="/list-koc/:kocId" element={<KocDetail />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:projectId" element={<ProjectDetail />} />
        <Route path="/reports" element={<Reports />} />
      </Routes>
      <Toaster />
    </Router>
  );
}

export default App;