import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MoreHorizontal, Bot, CalendarDays } from "lucide-react";
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

type Profile = {
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type Project = {
  id: string;
  name: string;
  created_at: string;
  profiles: Profile | null;
  tasks: { count: number }[];
};

interface ProjectCardProps {
  project: Project;
  onEdit: () => void;
  onDelete: () => void;
}

export const ProjectCard = ({ project, onEdit, onDelete }: ProjectCardProps) => {
  const taskCount = project.tasks[0]?.count || 0;
  const creatorName = project.profiles ? `${project.profiles.first_name || ''} ${project.profiles.last_name || ''}`.trim() : 'Không rõ';
  const creatorInitial = creatorName ? creatorName.charAt(0).toUpperCase() : '?';
  const creatorAvatar = project.profiles?.avatar_url;
  const formattedDate = format(new Date(project.created_at), "d MMM, yyyy", { locale: vi });

  return (
    <Card className="bg-white rounded-lg shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group border hover:border-red-500">
      <CardHeader className="flex-row justify-between items-start">
        <div className="flex-grow">
          <CardTitle className="text-lg font-bold text-gray-800 group-hover:text-red-600 transition-colors">
            <Link to={`/projects/${project.id}`} className="after:absolute after:inset-0">
              {project.name}
            </Link>
          </CardTitle>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 -mt-2 -mr-2 flex-shrink-0 relative z-10">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>Chỉnh sửa</DropdownMenuItem>
            <DropdownMenuItem className="text-red-600" onClick={onDelete}>Xóa</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-between">
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-red-500" />
            <span>{taskCount} bước</span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-red-500" />
            <span>Tạo ngày: {formattedDate}</span>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={creatorAvatar || undefined} alt={creatorName} />
            <AvatarFallback className="bg-red-100 text-red-600">{creatorInitial}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-gray-800">{creatorName}</p>
            <p className="text-xs text-gray-500">Người tạo</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};