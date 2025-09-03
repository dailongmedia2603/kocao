import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, LayoutDashboard, FolderKanban, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";

const menuItems = [
  {
    title: "MAIN MENU",
    items: [
      {
        label: "Dự án",
        icon: LayoutDashboard,
        to: "/",
      },
      { label: "Danh sách dự án", icon: FolderKanban, to: "/projects" },
      { label: "Settings", icon: Settings, to: "/settings" },
    ],
  },
];

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside className={cn("bg-white border-r flex flex-col transition-all duration-300", isCollapsed ? "w-20" : "w-64")}>
      <div className="flex items-center justify-between h-16 border-b px-4 flex-shrink-0">
        {!isCollapsed && <Logo />}
        <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)}>
          <ChevronLeft className={cn("h-5 w-5 transition-transform", isCollapsed && "rotate-180")} />
        </Button>
      </div>
      <nav className="flex-grow px-4 py-4 overflow-y-auto">
        {menuItems.map((section) => (
          <div key={section.title} className="mb-6">
            {!isCollapsed && <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">{section.title}</h2>}
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center p-2 rounded-md text-sm font-medium transition-colors text-gray-700 hover:bg-red-50 hover:text-red-600",
                      isActive && "bg-red-50 text-red-600"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-md transition-colors group-hover:bg-red-600 group-hover:text-white",
                        isActive ? "bg-red-600 text-white" : "bg-transparent"
                      )}>
                        <item.icon className="h-5 w-5" />
                      </div>
                      {!isCollapsed && <span className="ml-3">{item.label}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;