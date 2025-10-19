import { Handle, Position } from 'reactflow';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, FileText } from 'lucide-react';

const TaskNode = ({ data }) => {
  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'running': return <Badge variant="outline" className="text-blue-800 border-blue-200">Running</Badge>;
      case 'failed': return <Badge variant="destructive">Failed</Badge>;
      case 'pending': return <Badge variant="secondary">Pending</Badge>;
      case 'queued': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Queued</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Card className="w-64 shadow-md">
      <Handle type="target" position={Position.Left} className="!bg-slate-400" />
      <CardHeader className="flex flex-row items-center justify-between p-3 space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {data.type === 'AI' ? <Bot className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
          {data.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        {getStatusBadge(data.status)}
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-slate-400" />
    </Card>
  );
};

export default TaskNode;