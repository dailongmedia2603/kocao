import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit, Trash2 } from "lucide-react";

type Koc = {
  id: string;
  name: string;
  field: string | null;
  avatar_url: string | null;
  folder_path: string | null;
};

const StatItem = ({ label, value }: { label: string; value: string }) => (
  <div className="text-center px-2">
    <p className="text-xs text-muted-foreground uppercase tracking-wider">
      {label}
    </p>
    <p className="font-bold text-lg text-gray-800">{value}</p>
  </div>
);

export const KocCard = ({
  koc,
  onEdit,
  onDelete,
}: {
  koc: Koc;
  onEdit: (koc: Koc) => void;
  onDelete: (koc: Koc) => void;
}) => {
  // Dữ liệu mẫu cho các chỉ số như đã yêu cầu
  const stats = [
    { label: "Followers", value: "---" },
    { label: "Engagement", value: "---" },
    { label: "Avg. Likes", value: "---" },
  ];

  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    action();
  };

  return (
    <Card className="hover:shadow-lg transition-shadow relative group bg-white">
      <Link to={`/list-koc/${koc.id}`} className="block p-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border">
              <AvatarImage src={koc.avatar_url || undefined} alt={koc.name} />
              <AvatarFallback className="text-2xl bg-gray-100">
                {koc.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-bold text-lg text-gray-900 group-hover:text-primary transition-colors">
                {koc.name}
              </h3>
              {koc.field && (
                <p className="text-sm text-muted-foreground">{koc.field}</p>
              )}
            </div>
          </div>
          <Badge className="bg-green-100 text-green-800 border-green-200 font-semibold">
            Active
          </Badge>
        </div>

        <Separator />

        <div className="flex justify-between text-center mt-4">
          {stats.map((stat) => (
            <StatItem key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </div>
      </Link>
      <div className="absolute top-2 right-2 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.preventDefault()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => handleActionClick(e, () => onEdit(koc))}
            >
              <Edit className="mr-2 h-4 w-4" /> Sửa
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => handleActionClick(e, () => onDelete(koc))}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Xóa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
};