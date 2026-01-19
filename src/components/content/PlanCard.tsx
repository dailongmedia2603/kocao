import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2, ClipboardList, Calendar, Target, FileText, Sparkles } from "lucide-react";
import { ContentPlanWithKoc } from "@/types/contentPlan";
import { format } from "date-fns";

type PlanCardProps = {
  plan: ContentPlanWithKoc;
  onEdit: (plan: ContentPlanWithKoc) => void;
  onDelete: (plan: ContentPlanWithKoc) => void;
};

const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase();

const statusMap: { [key: string]: { text: string; className: string; dotColor: string } } = {
  draft: { text: "Bản nháp", className: "bg-gray-100 text-gray-600 border-gray-200", dotColor: "bg-gray-400" },
  completed: { text: "Hoàn thành", className: "bg-emerald-50 text-emerald-600 border-emerald-100", dotColor: "bg-emerald-500" },
  generating: { text: "Đang xử lý", className: "bg-blue-50 text-blue-600 border-blue-100", dotColor: "bg-blue-500" },
  failed: { text: "Thất bại", className: "bg-red-50 text-red-600 border-red-100", dotColor: "bg-red-500" },
};

export const PlanCard = ({ plan, onEdit, onDelete }: PlanCardProps) => {
  const statusInfo = statusMap[plan.status] || statusMap.draft;

  return (
    <Card className="group relative border border-gray-200 shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:shadow-[0_20px_40px_-5px_rgba(0,0,0,0.18)] hover:border-red-200 transition-all duration-300 rounded-[24px] bg-white flex flex-col h-full hover:-translate-y-1">
      <Link to={`/tao-ke-hoach/${plan.id}`} className="absolute inset-0 z-10" aria-label={`View details for ${plan.name}`} />

      <CardContent className="p-6 flex flex-col h-full">
        <div className="flex items-start gap-5">
          {/* Icon Box: Unified Professional Brand Style */}
          <div className="w-14 h-14 rounded-[20px] flex items-center justify-center bg-gradient-to-br from-red-50 to-rose-100 text-red-600 shadow-sm border border-red-100 shrink-0 transition-transform group-hover:scale-105 duration-500">
            <ClipboardList className="w-7 h-7" />
          </div>

          {/* Content Container */}
          <div className="flex-1 min-w-0 pt-1">
            {/* Title */}
            <h3 className="text-[17px] font-bold text-gray-900 group-hover:text-red-600 transition-colors line-clamp-2 leading-snug mb-3">
              {plan.name}
            </h3>

            {/* Metadata Row: Badge | Date */}
            <div className="flex items-center gap-3 text-sm text-gray-500 font-medium">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 text-gray-600 border border-gray-200 text-xs font-semibold`}>
                <span className={`w-2 h-2 rounded-full ${statusInfo.dotColor}`}></span>
                {statusInfo.text}
              </div>

              <span className="text-gray-300">|</span>

              <div className="flex items-center text-xs">
                <Calendar className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                <span>{plan.created_at ? format(new Date(plan.created_at), "dd/MM") : "--/--"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer: KOC Info */}
        <div className="mt-6 pt-4 border-t border-dashed border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 ring-2 ring-white shadow-sm border border-gray-200">
              <AvatarImage src={plan.kocs?.avatar_url || undefined} />
              <AvatarFallback className="text-xs bg-gray-50 text-gray-600 font-bold">
                {plan.kocs ? getInitials(plan.kocs.name) : '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">KOC</span>
              <span className="text-sm font-bold text-gray-800 leading-none truncate max-w-[140px]">{plan.kocs?.name || 'Chưa gán'}</span>
            </div>
          </div>

          {/* Dropdown Action */}
          <div className="relative z-20">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100/80 transition-colors" onClick={(e) => e.preventDefault()}>
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl border-gray-200">
                <DropdownMenuItem onClick={(e) => { e.preventDefault(); onEdit(plan); }} className="gap-2 cursor-pointer py-2.5 font-medium">
                  <Edit className="h-4 w-4 text-blue-600" /> Chỉnh sửa
                </DropdownMenuItem>
                <DropdownMenuItem className="text-red-600 gap-2 cursor-pointer py-2.5 font-medium" onClick={(e) => { e.preventDefault(); onDelete(plan); }}>
                  <Trash2 className="h-4 w-4" /> Xóa kế hoạch
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};