import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Users, Mic, FileText, Captions } from "lucide-react";

const navItems = [
  { label: "KOCs", to: "/list-koc", icon: Users },
  { label: "Tạo Voice", to: "/create-voice", icon: Mic },
  { label: "Tạo Content", to: "/tao-content", icon: FileText },
  { label: "Tách Script", to: "/video-to-script", icon: Captions },
];

const KocMobileNav = () => {
  return (
    <div className="mb-6 overflow-x-auto pb-2 -mb-2 no-scrollbar">
        <div className="flex items-center gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/list-koc"}
              className={({ isActive }) =>
                cn(
                  "inline-flex items-center gap-2 rounded-lg p-2 px-3 text-sm font-semibold shadow-none border transition-colors whitespace-nowrap",
                  isActive
                    ? "bg-red-50 text-red-600 border-red-200"
                    : "bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </div>
    </div>
  );
};

export default KocMobileNav;