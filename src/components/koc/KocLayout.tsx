import { Outlet } from "react-router-dom";
import Sidebar from "../Sidebar";
import KocHeader from "./KocHeader";
import MobileHeader from "../MobileHeader";
import BottomNavBar from "../BottomNavBar";
import { useSession } from "@/contexts/SessionContext";
import { LoadingSpinner } from "../LoadingSpinner";

const KocLayout = () => {
  const { loading } = useSession();

  return (
    <>
      {/* Giao diện Desktop: Ẩn trên mobile (md:flex) */}
      <div className="hidden md:flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <KocHeader />
          <main className="flex-1 overflow-y-auto bg-gray-50/50">
            {loading ? <LoadingSpinner /> : <Outlet />}
          </main>
        </div>
      </div>

      {/* Giao diện Mobile: Chỉ hiển thị trên mobile (md:hidden) */}
      <div className="md:hidden flex flex-col h-screen bg-gray-50/50">
        <MobileHeader />
        <main className="flex-1 overflow-y-auto pb-20">
          {loading ? <LoadingSpinner /> : <Outlet />}
        </main>
        <BottomNavBar />
      </div>
    </>
  );
};

export default KocLayout;