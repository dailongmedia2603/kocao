import { Link } from "react-router-dom";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import type { Project } from "@/pages/ProjectsList";

type ProjectCardProps = {
  project: Project;
};

const getInitials = (firstName?: string | null, lastName?: string | null) => {
  const first = firstName?.[0] || "";
  const last = lastName?.[0] || "";
  return `${first}${last}`.toUpperCase() || "??";
};

export const ProjectCard = ({ project }: ProjectCardProps) => {
  const taskCount = project.tasks?.[0]?.count || 0;

  return (
    <Link to={`/projects/${project.id}`}>
      <Card className="hover:shadow-md transition-shadow h-full flex flex-col">
        <CardHeader>
          <CardTitle className="truncate">{project.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow">
          <p className="text-sm text-muted-foreground">
            {taskCount} kịch bản
          </p>
        </CardContent>
        <CardFooter className="flex justify-between items-center text-sm text-muted-foreground">
          <span>
            {formatDistanceToNow(new Date(project.created_at), { addSuffix: true, locale: vi })}
          </span>
          <Avatar className="h-8 w-8">
            <AvatarImage src={project.profiles?.avatar_url || undefined} />
            <AvatarFallback>
              {getInitials(project.profiles?.first_name, project.profiles?.last_name)}
            </AvatarFallback>
          </Avatar>
        </CardFooter>
      </Card>
    </Link>
  );
};