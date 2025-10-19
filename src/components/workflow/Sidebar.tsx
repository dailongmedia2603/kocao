import { Bot, FileText } from 'lucide-react';

const Sidebar = () => {
  const onDragStart = (event, nodeType, nodeName) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ type: nodeType, name: nodeName }));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-64 p-4 border-l bg-white">
      <h3 className="text-lg font-semibold mb-4">Thêm Nodes</h3>
      <div className="space-y-2">
        <div
          className="p-3 border rounded-md cursor-grab flex items-center gap-2 bg-gray-50 hover:bg-gray-100"
          onDragStart={(event) => onDragStart(event, 'AI', 'AI Task')}
          draggable
        >
          <Bot className="h-5 w-5 text-blue-500" />
          <span>AI Task</span>
        </div>
        <div
          className="p-3 border rounded-md cursor-grab flex items-center gap-2 bg-gray-50 hover:bg-gray-100"
          onDragStart={(event) => onDragStart(event, 'EXTRACT', 'Extract Data')}
          draggable
        >
          <FileText className="h-5 w-5 text-green-500" />
          <span>Extract Task</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;