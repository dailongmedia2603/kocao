import { NavLink } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSession } from "@/contexts/SessionContext";
import { cn } from "@/lib/utils";
import { Video, Mic, PenSquare, Captions, BarChart3 } from "lucide-react";

const navItems = [
  { label: "KOCs Manager", icon: Video, to: "/list-koc" },
  { label: "Tạo Voice", icon: Mic, to: "/create-voice" },
  { label: "Tạo Content", icon: PenSquare, to: "/tao-content" },
  { label: "Tách Script", icon: Captions, to: "/video-to-script" },
  { label: "Report", icon: BarChart3, to: "/reports" },
];

const KocHeader = () => {
  const { profile, user, signOut } = useSession();

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.[0] || "";
    const last = lastName?.[0] || "";
    return `${first}${last}`.toUpperCase() || user?.email?.[0].toUpperCase() || "??";
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6 flex-shrink-0">
      <nav className="flex items-center gap-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 p-2 rounded-md text-sm font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors",
                isActive && "bg-red-50 text-red-600"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="cursor-pointer">
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback>{getInitials(profile?.first_name, profile?.last_name)}</AvatarFallback>
              </Avatar>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem onClick={signOut}>Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default KocHeader;