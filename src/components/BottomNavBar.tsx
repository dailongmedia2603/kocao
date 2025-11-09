import { NavLink, useLocation } from "react-router-dom";
import { Video, Bot, Film, Users, Settings, ClipboardList, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/contexts/SessionContext";

const BottomNavBar = () => {
  const { profile } = useSession();
  const location = useLocation();

  const allMenuItems = [
    { label: "KOC", icon: Video, to: "/list-koc", paths: ["/list-koc", "/create-voice", "/tao-content", "/video-to-script"] },
    { label: "Kế hoạch", icon: ClipboardList, to: "/tao-ke-hoach", paths: ["/tao-ke-hoach"] },
    { label: "Automation", icon: Bot, to: "/automation", paths: ["/automation"] },
    { label: "Tạo Video", icon: Film, to: "/tao-video", paths: ["/tao-video"] },
    { label: "Gói cước", icon: Layers, to: "/subscription", paths: ["/subscription"] },
  ];

  const adminMenuItems = [
    { label: "Users", icon: Users, to: "/admin/users", paths: ["/admin/users"] },
    { label: "Gói cước", icon: Layers, to: "/admin/plans", paths: ["/admin/plans"] },
    { label: "Cài đặt", icon: Settings, to: "/settings", paths: ["/settings"] },
  ];

  const itemsToShow = profile?.role === 'admin' ? [...allMenuItems.slice(0, 2), ...adminMenuItems, ...allMenuItems.slice(2)] : allMenuItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t z-50 flex items-center justify-around shadow-[0_-1px_3px_rgba(0,0,0,0.1)]">
      {itemsToShow.map((item) => {
        const isActive = item.paths.some(path => location.pathname.startsWith(path));
        return (
          <NavLink 
            key={item.to} 
            to={item.to} 
            className={cn(
              "flex flex-col items-center justify-center gap-1 flex-1 p-2 text-xs font-medium transition-colors",
              isActive ? "text-red-600" : "text-gray-500 hover:text-red-600"
            )}
          >
            <item.icon className="h-6 w-6" />
            <span className="whitespace-nowrap">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};

export default BottomNavBar;