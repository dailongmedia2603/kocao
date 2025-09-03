import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Dot, LayoutDashboard, FolderKanban, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";

const menuItems = [
  {
    title: "MAIN MENU",
    items: [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        to: "/",
        subItems: [
          { label: "Project Dashboard", to: "/" },
        ],
      },
      { label: "Projects", icon: FolderKanban, to: "/projects" },
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
        <Accordion type="multiple" defaultValue={["Dashboard"]} className="w-full">
          {menuItems.map((section) => (
            <div key={section.title} className="mb-6">
              {!isCollapsed && <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">{section.title}</h2>}
              {section.items.map((item) =>
                item.subItems ? (
                  <AccordionItem key={item.label} value={item.label} className="border-none">
                    <AccordionTrigger className="p-0 hover:no-underline">
                      <NavLink
                        to={item.to}
                        end
                        className={({ isActive }) =>
                          cn(
                            "flex items-center w-full p-2 rounded-md text-sm font-medium transition-colors text-gray-700 hover:bg-red-50 hover:text-red-600",
                            isActive && "bg-red-50 text-red-600"
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <div className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                              isActive ? "bg-red-600 text-white" : "bg-transparent"
                            )}>
                              <item.icon className="h-5 w-5" />
                            </div>
                            {!isCollapsed && <span className="ml-3">{item.label}</span>}
                          </>
                        )}
                      </NavLink>
                    </AccordionTrigger>
                    {!isCollapsed && (
                      <AccordionContent className="pl-6 pb-0">
                        <ul className="space-y-1 mt-1">
                          {item.subItems.map((sub) => (
                            <li key={sub.label}>
                              <NavLink
                                to={sub.to}
                                end
                                className={({ isActive }) =>
                                  cn(
                                    "flex items-center p-2 rounded-md text-sm text-gray-600 hover:text-red-600",
                                    isActive && "text-red-600 font-semibold"
                                  )
                                }
                              >
                                <Dot className="h-5 w-5" />
                                {sub.label}
                              </NavLink>
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    )}
                  </AccordionItem>
                ) : (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center p-2 rounded-md text-sm font-medium transition-colors text-gray-700 hover:bg-red-50 hover:text-red-600",
                        isActive && "bg-red-50 text-red-600"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                          isActive ? "bg-red-600 text-white" : "bg-transparent"
                        )}>
                          <item.icon className="h-5 w-5" />
                        </div>
                        {!isCollapsed && <span className="ml-3">{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                )
              )}
            </div>
          ))}
        </Accordion>
      </nav>
    </aside>
  );
};

export default Sidebar;