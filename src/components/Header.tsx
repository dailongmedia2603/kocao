import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSession } from "@/contexts/SessionContext";

const Header = () => {
  const { profile, user, signOut, subscription } = useSession();

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.[0] || "";
    const last = lastName?.[0] || "";
    return `${first}${last}`.toUpperCase() || user?.email?.[0].toUpperCase() || "??";
  };

  return (
    <header className="flex h-16 items-center justify-end border-b bg-white px-6 flex-shrink-0">
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
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {`${profile?.last_name || ''} ${profile?.first_name || ''}`.trim()}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            {subscription && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="focus:bg-transparent opacity-100">
                  <div className="text-xs w-full">
                    <p className="font-semibold">{subscription.plan_name}</p>
                    <p className="text-muted-foreground">
                      Video đã dùng: {subscription.videos_used} / {subscription.video_limit}
                    </p>
                  </div>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem onClick={signOut}>Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;