import { Project } from '@/data/projects';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Star, MoreHorizontal, Clock, DollarSign, CalendarDays, MessageCircle, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProjectCardProps {
  project: Project;
}

export const ProjectCard = ({ project }: ProjectCardProps) => {
  const priorityClasses = {
    High: 'bg-red-100 text-red-700',
    Medium: 'bg-yellow-100 text-yellow-700',
    Low: 'bg-blue-100 text-blue-700',
  };

  return (
    <Card className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div className="flex gap-2">
            <Badge className={cn('font-semibold', priorityClasses[project.priority])}>
              <span className="w-2 h-2 rounded-full bg-current mr-1.5"></span>
              {project.priority}
            </Badge>
            <Badge className="bg-green-100 text-green-700 font-semibold">{project.status}</Badge>
          </div>
          <Star className={cn('h-5 w-5 text-gray-300 cursor-pointer', project.isFavorite && 'text-yellow-400 fill-yellow-400')} />
        </div>

        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg mb-4">
          <div className="flex items-center gap-3">
            <div className={cn("h-12 w-12 rounded-full flex items-center justify-center text-xl font-bold text-white", project.logo.bgColor)}>
              {project.logo.text}
            </div>
            <div>
              <h3 className="font-bold text-gray-800">{project.name}</h3>
              <p className="text-sm text-gray-500">{project.type}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="text-gray-500">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>

        <p className="text-gray-600 text-sm mb-5">{project.description}</p>

        <div className="space-y-3 text-sm text-gray-600 mb-5">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <span>Project ID : <span className="font-medium text-gray-800">{project.projectId}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-gray-400" />
            <span>Value : <span className="font-medium text-gray-800">{project.value}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-gray-400" />
            <span>Due Date : <span className="font-medium text-gray-800">{project.dueDate}</span></span>
          </div>
        </div>

        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center -space-x-2">
            {project.team.slice(0, 3).map((avatar, index) => (
              <img key={index} src={avatar} alt="team member" className="h-8 w-8 rounded-full border-2 border-white" />
            ))}
            {project.team.length > 3 && (
              <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 border-2 border-white">
                +{project.team.length - 3}
              </div>
            )}
          </div>
          <img src={project.clientLogo} alt="client logo" className="h-9 w-9 rounded-full" />
        </div>

        <div className="border-t pt-4 flex justify-between items-center">
          <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">
            <Clock className="h-4 w-4 mr-1.5" />
            Total Hours : {project.totalHours}
          </Badge>
          <div className="flex items-center gap-4 text-gray-500">
            <div className="flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4" />
              <span className="text-sm font-medium">{project.comments}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Paperclip className="h-4 w-4" />
              <span className="text-sm font-medium">{project.attachments}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};