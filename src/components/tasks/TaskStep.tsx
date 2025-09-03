import { TaskStepIcon } from "./TaskStepIcon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

type Task = {
  id: string;
  name: string;
  status: 'completed' | 'failed' | 'running' | 'queued' | 'pending' | string;
  type: string | null;
  error_log: string | null;
  payload: any;
};

interface TaskStepProps {
  task: Task;
  isLast: boolean;
}

export const TaskStep = ({ task, isLast }: TaskStepProps) => {
  const statusStyles = {
    completed: {
      badge: "bg-green-100 text-green-800 border-green-200",
      card: "border-green-200 bg-green-50/50",
      line: "bg-green-500",
    },
    failed: {
      badge: "bg-red-100 text-red-800 border-red-200",
      card: "border-red-200 bg-red-50/50",
      line: "bg-red-500",
    },
    running: {
      badge: "bg-blue-100 text-blue-800 border-blue-200",
      card: "border-blue-300 bg-blue-50/50 ring-2 ring-blue-200",
      line: "bg-blue-500",
    },
    queued: {
      badge: "bg-yellow-100 text-yellow-800 border-yellow-200",
      card: "border-yellow-200 bg-yellow-50/50",
      line: "bg-gray-300",
    },
    pending: {
      badge: "bg-gray-100 text-gray-800 border-gray-200",
      card: "border-gray-200 bg-white",
      line: "bg-gray-300",
    },
  };

  const styles = statusStyles[task.status as keyof typeof statusStyles] || statusStyles.pending;

  return (
    <div className="flex gap-x-4 relative">
      {/* Timeline Line */}
      <div className="absolute left-5 top-5 h-full w-0.5 bg-gray-200 -z-10" />
      {!isLast && (
        <div className={cn("absolute left-5 top-5 h-full w-0.5", styles.line)} />
      )}

      {/* Icon */}
      <div className="relative z-10">
        <TaskStepIcon status={task.status} />
      </div>

      {/* Task Card */}
      <div className="flex-grow pt-1.5">
        <Card className={cn("mb-8 transition-all", styles.card)}>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg font-semibold text-gray-800">{task.name}</CardTitle>
              <Badge variant="outline" className={cn("capitalize", styles.badge)}>{task.status}</Badge>
            </div>
            {task.type && <CardDescription>Loại: {task.type}</CardDescription>}
          </CardHeader>
          {(task.error_log || task.payload) && (
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="details">
                  <AccordionTrigger className="text-sm">Xem chi tiết</AccordionTrigger>
                  <AccordionContent>
                    {task.error_log && (
                      <div className="mt-2">
                        <h4 className="font-semibold text-red-600">Lỗi</h4>
                        <pre className="mt-1 text-xs bg-red-50 p-2 rounded-md text-red-700 whitespace-pre-wrap break-all">
                          {task.error_log}
                        </pre>
                      </div>
                    )}
                    {task.payload && (
                       <div className="mt-2">
                        <h4 className="font-semibold text-gray-600">Payload</h4>
                        <pre className="mt-1 text-xs bg-gray-100 p-2 rounded-md text-gray-700 whitespace-pre-wrap break-all">
                          {JSON.stringify(task.payload, null, 2)}
                        </pre>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
};