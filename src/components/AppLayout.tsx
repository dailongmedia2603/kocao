import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import MobileHeader from "./MobileHeader";
import BottomNavBar from "./BottomNavBar";

const AppLayout = () => {
  return (
    <>
      {/* Giao diện Desktop: Ẩn trên mobile (md:flex) */}
      <div className="hidden md:flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto bg-gray-50/50">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Giao diện Mobile: Chỉ hiển thị trên mobile (md:hidden) */}
      <div className="md:hidden flex flex-col h-screen bg-gray-50/50">
        <MobileHeader />
        <main className="flex-1 overflow-y-auto pb-20">
          <Outlet />
        </main>
        <BottomNavBar />
      </div>
    </>
  );
};

export default AppLayout;