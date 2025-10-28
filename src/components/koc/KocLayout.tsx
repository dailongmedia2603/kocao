import { Outlet } from "react-router-dom";
import Sidebar from "../Sidebar";
import KocHeader from "./KocHeader";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileHeader from "../MobileHeader";
import BottomNavBar from "../BottomNavBar";

const KocLayout = () => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-gray-50/50">
        <MobileHeader />
        <main className="flex-1 overflow-y-auto pb-20">
          <Outlet />
        </main>
        <BottomNavBar />
      </div>
    );
  }

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