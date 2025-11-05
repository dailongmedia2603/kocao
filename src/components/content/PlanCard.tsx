import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { ContentPlanWithKoc } from "@/types/contentPlan";

type PlanCardProps = {
  plan: ContentPlanWithKoc;
  onEdit: (plan: ContentPlanWithKoc) => void;
  onDelete: (plan: ContentPlanWithKoc) => void;
};

const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase();

const statusMap: { [key: string]: { text: string; className: string } } = {
  draft: { text: "Bản nháp", className: "bg-gray-100 text-gray-800" },
  completed: { text: "Hoàn thành", className: "bg-green-100 text-green-800" },
  generating: { text: "Đang xử lý", className: "bg-blue-100 text-blue-800" },
  failed: { text: "Thất bại", className: "bg-red-100 text-red-800" },
};

export const PlanCard = ({ plan, onEdit, onDelete }: PlanCardProps) => {
  const statusInfo = statusMap[plan.status] || statusMap.draft;

  return (
    <Card className="relative group hover:shadow-lg transition-shadow duration-300 flex flex-col">
      <Link to={`/tao-ke-hoach/${plan.id}`} className="absolute inset-0 z-10" aria-label={`View details for ${plan.name}`} />
      <CardHeader className="flex-row items-start justify-between">
        <CardTitle className="text-lg">{plan.name}</CardTitle>
        <Badge variant="outline" className={statusInfo.className}>{statusInfo.text}</Badge>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-end">
        <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/50">
          <Avatar className="h-10 w-10 border">
            <AvatarImage src={plan.kocs?.avatar_url || undefined} />
            <AvatarFallback>{plan.kocs ? getInitials(plan.kocs.name) : '?'}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm text-muted-foreground">Dành cho KOC</p>
            <p className="font-semibold">{plan.kocs?.name || 'Không rõ'}</p>
          </div>
        </div>
      </CardContent>
      <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.preventDefault()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.preventDefault(); onEdit(plan); }}>
              <Edit className="mr-2 h-4 w-4" /> Chỉnh sửa
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={(e) => { e.preventDefault(); onDelete(plan); }}>
              <Trash2 className="mr-2 h-4 w-4" /> Xóa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
};