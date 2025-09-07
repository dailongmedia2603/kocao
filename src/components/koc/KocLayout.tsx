import { Outlet } from "react-router-dom";
import Sidebar from "../Sidebar";
import KocHeader from "./KocHeader";

const KocLayout = () => {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <KocHeader />
        <main className="flex-1 overflow-y-auto bg-gray-50/50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default KocLayout;