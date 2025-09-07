import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

type Koc = {
  id: string;
  name: string;
  field: string | null;
  avatar_url: string | null;
  folder_path: string | null;
};

type KocCardProps = {
  koc: Koc;
  onEdit: (koc: Koc) => void;
  onDelete: (koc: Koc) => void;
};

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
};

export const KocCard = ({ koc, onEdit, onDelete }: KocCardProps) => {
  return (
    <Card className="relative flex flex-col hover:shadow-lg transition-shadow duration-300">
      <Link
        to={`/list-koc/${koc.id}`}
        className="absolute inset-0 z-0"
        aria-label={`View details for ${koc.name}`}
      />
      <CardHeader className="flex flex-row items-start justify-between p-4 space-x-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar className="h-12 w-12 border-2 border-white shadow-sm flex-shrink-0">
            <AvatarImage src={koc.avatar_url || undefined} alt={koc.name} />
            <AvatarFallback>{getInitials(koc.name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold truncate">{koc.name}</h3>
            {koc.field && (
              <Badge variant="secondary" className="mt-1 font-normal text-xs">
                <Tag className="mr-1 h-3 w-3" />
                {koc.field}
              </Badge>
            )}
          </div>
        </div>
        <div className="relative z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0 flex-shrink-0"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(koc)}>
                <Edit className="mr-2 h-4 w-4" />
                <span>Chỉnh sửa</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(koc)}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Xóa</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div className="grid grid-cols-3 gap-2 text-center border-t pt-4">
          <div>
            <p className="text-sm font-bold text-red-600">1.2M</p>
            <p className="text-xs text-red-600">Followers</p>
          </div>
          <div>
            <p className="text-sm font-bold text-red-600">5.8%</p>
            <p className="text-xs text-red-600">Engagement</p>
          </div>
          <div>
            <p className="text-sm font-bold text-red-600">120K</p>
            <p className="text-xs text-red-600">Avg. Likes</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};