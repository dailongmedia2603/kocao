import { useState, useEffect, useCallback, useRef } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';
import TaskNode from './TaskNode';
import Sidebar from './Sidebar';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';

const nodeTypes = { task: TaskNode };

const WorkflowBuilder = ({ projectId }) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('execution_order', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  useEffect(() => {
    if (tasks) {
      const newNodes = tasks.map((task, index) => ({
        id: task.id,
        type: 'task',
        position: task.payload?.position || { x: index * 300, y: 100 },
        data: { name: task.name, type: task.type, status: task.status },
      }));
      const newEdges = [];
      for (let i = 0; i < tasks.length - 1; i++) {
        newEdges.push({
          id: `e${tasks[i].id}-${tasks[i+1].id}`,
          source: tasks[i].id,
          target: tasks[i+1].id,
          animated: tasks[i+1].status === 'running' || tasks[i+1].status === 'queued',
        });
      }
      setNodes(newNodes);
      setEdges(newEdges);
    }
  }, [tasks, setNodes, setEdges]);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const { type, name } = JSON.parse(event.dataTransfer.getData('application/reactflow'));

      if (typeof type === 'undefined' || !type) return;

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });
      
      createTaskMutation.mutate({ name, type, position });
    },
    [reactFlowInstance, createTaskMutation]
  );

  const createTaskMutation = useMutation({
    mutationFn: async ({ name, type, position }: { name: string; type: string; position: { x: number; y: number } }) => {
      if (!user) throw new Error("User not authenticated");
      const { data: maxOrderResult, error: maxOrderError } = await supabase
        .from('tasks')
        .select('execution_order')
        .eq('project_id', projectId)
        .order('execution_order', { ascending: false })
        .limit(1)
        .single();
      
      if (maxOrderError && maxOrderError.code !== 'PGRST116') throw maxOrderError;

      const newOrder = (maxOrderResult?.execution_order || 0) + 1;

      const { error } = await supabase.from('tasks').insert({
        project_id: projectId,
        user_id: user.id,
        name,
        type,
        status: 'pending',
        execution_order: newOrder,
        payload: { position },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Task created!");
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
    onError: (error: Error) => showError(error.message),
  });

  const saveLayoutMutation = useMutation({
    mutationFn: async () => {
      if (!tasks) return;
      const updates = nodes.map(node => {
        const task = tasks.find(t => t.id === node.id);
        return supabase
          .from('tasks')
          .update({ payload: { ...task.payload, position: node.position } })
          .eq('id', node.id);
      });
      const results = await Promise.all(updates);
      results.forEach(result => {
        if (result.error) throw result.error;
      });
    },
    onSuccess: () => {
      showSuccess("Layout saved!");
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
    onError: (error: Error) => showError(error.message),
  });

  return (
    <div className="flex h-[calc(100vh-150px)]">
      <div className="flex-grow" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          fitView
        >
          <Controls />
          <Background />
          <MiniMap />
          <div className="absolute top-4 right-4 z-10">
            <Button onClick={() => saveLayoutMutation.mutate()} disabled={saveLayoutMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {saveLayoutMutation.isPending ? 'Saving...' : 'Save Layout'}
            </Button>
          </div>
        </ReactFlow>
      </div>
      <Sidebar />
    </div>
  );
};

const ProjectDetailWorkflow = ({ projectId }) => (
  <ReactFlowProvider>
    <WorkflowBuilder projectId={projectId} />
  </ReactFlowProvider>
);

export default ProjectDetailWorkflow;