import { CheckCircle2, XCircle, Loader, Circle, Bot, Hourglass } from 'lucide-react';
import { cn } from "@/lib/utils";

type TaskStepIconProps = {
  status: 'completed' | 'failed' | 'running' | 'queued' | 'pending' | string;
  className?: string;
};

export const TaskStepIcon = ({ status, className }: TaskStepIconProps) => {
  const statusConfig = {
    completed: {
      icon: <CheckCircle2 size={20} />,
      bg: "bg-green-500",
    },
    failed: {
      icon: <XCircle size={20} />,
      bg: "bg-red-500",
    },
    running: {
      icon: <Loader size={20} className="animate-spin" />,
      bg: "bg-blue-500",
    },
    queued: {
      icon: <Hourglass size={20} />,
      bg: "bg-yellow-500",
    },
    pending: {
      icon: <Bot size={20} />,
      bg: "bg-gray-400",
    },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

  return (
    <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white ring-4 ring-white", config.bg, className)}>
      {config.icon}
    </div>
  );
};