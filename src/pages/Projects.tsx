import { ProjectCard } from '@/components/ProjectCard';
import { projectsData } from '@/data/projects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Filter, Search, List, LayoutGrid, Plus, Upload, RefreshCw, ChevronRight } from 'lucide-react';

const ProjectsPage = () => {
  return (
    <div className="p-6 lg:p-8">
      <header className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-800">Projects</h1>
            <Badge className="bg-red-100 text-red-600 px-2.5 py-0.5 text-sm font-semibold">125</Badge>
          </div>
          <div className="flex items-center text-sm text-gray-500 mt-1">
            <span>Home</span>
            <ChevronRight className="h-4 w-4 mx-1" />
            <span className="font-medium text-gray-700">Projects</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="bg-white">
            <Upload className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="icon" className="bg-white">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap justify-between items-center gap-4 mb-6 p-4 bg-white rounded-lg border">
        <div className="flex items-center gap-4">
          <Button variant="outline" className="bg-white">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search" className="pl-9" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <List className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 bg-gray-100">
              <LayoutGrid className="h-5 w-5" />
            </Button>
          </div>
          <Button className="bg-red-600 hover:bg-red-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Add New Project
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
        {projectsData.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
};

export default ProjectsPage;