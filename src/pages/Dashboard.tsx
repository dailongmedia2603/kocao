import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Calendar, ChevronDown, Download, Plus, RefreshCw } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const recentProjects = [
  { name: "Truelysell", company: "NovaWave LLC", priority: "High", dueDate: "23 Nov 2025", logo: "https://tailwindui.com/img/logos/48x48/reform.svg" },
  { name: "Dreamschat", company: "BlueSky", priority: "Medium", dueDate: "07 Nov 2025", logo: "https://tailwindui.com/img/logos/48x48/savvycal.svg" },
  { name: "DreamGigs", company: "Silve Hawk", priority: "High", dueDate: "15 Oct 2025", logo: "https://tailwindui.com/img/logos/48x48/transistor.svg" },
  { name: "Servbook", company: "Summit Peak", priority: "High", dueDate: "29 Sep 2025", logo: "https://tailwindui.com/img/logos/48x48/statickit.svg" },
  { name: "DreamPOS", company: "RiverStone Ltd", priority: "Medium", dueDate: "25 Sep 2025", logo: "https://tailwindui.com/img/logos/48x48/tuple.svg" },
];

const pieData = [
  { name: "Campaigns", value: 44, color: "#8B5CF6" },
  { name: "Google", value: 55, color: "#F59E0B" },
  { name: "Referrals", value: 41, color: "#3B82F6" },
  { name: "Paid Social", value: 17, color: "#EF4444" },
];

const PriorityBadge = ({ priority }: { priority: string }) => {
  const styles = {
    High: "bg-red-100 text-red-700 border-red-200",
    Medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  };
  return <Badge variant="outline" className={cn("font-semibold", styles[priority])}>{priority}</Badge>;
};

const CustomLegend = (props) => {
  const { payload } = props;
  return (
    <ul className="flex justify-center gap-4 mt-4">
      {payload.map((entry, index) => (
        <li key={`item-${index}`} className="flex items-center gap-2 text-sm text-gray-600">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }}></span>
          {entry.payload.name} - {entry.payload.value}
        </li>
      ))}
    </ul>
  );
};

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Project Dashboard</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="bg-white">
            <Calendar className="mr-2 h-4 w-4" />
            5 Aug 25 - 3 Sep 25
          </Button>
          <Button variant="outline" size="icon" className="bg-white"><RefreshCw className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="bg-white"><Download className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Projects</CardTitle>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="bg-white">
                    Last 30 days <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>Last 7 days</DropdownMenuItem>
                  <DropdownMenuItem>Last 30 days</DropdownMenuItem>
                  <DropdownMenuItem>Last 90 days</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button className="bg-primary text-primary-foreground">
                <Plus className="mr-2 h-4 w-4" />
                Add Project
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 text-sm font-semibold text-gray-500 px-4 pb-2 border-b">
              <div>Name</div>
              <div>Company Name</div>
              <div>Priority</div>
              <div>Due Date</div>
            </div>
            <div className="divide-y">
              {recentProjects.map((project, index) => (
                <div key={index} className="grid grid-cols-4 items-center p-4 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <img src={project.logo} alt={project.name} className="h-8 w-8 rounded-full" />
                    <span className="font-medium">{project.name}</span>
                  </div>
                  <div className="font-medium">{project.company}</div>
                  <div><PriorityBadge priority={project.priority} /></div>
                  <div>{project.dueDate}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Project By Stage</CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-white">
                  Last 30 days <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Last 7 days</DropdownMenuItem>
                <DropdownMenuItem>Last 30 days</DropdownMenuItem>
                <DropdownMenuItem>Last 90 days</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={100} stroke="none">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <CustomLegend payload={pieData.map(item => ({...item, type: 'circle', color: item.color, payload: item}))} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;