import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2, Tag, Link as LinkIcon, Video, ScanLine, Loader2, Users, Heart, Clapperboard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { useRef } from "react";

type Koc = {
  id: string;
  name: string;
  field: string | null;
  avatar_url: string | null;
  channel_url: string | null;
  video_count: number;
  follower_count?: number | null;
  like_count?: number | null;
  generated_video_count?: number;
};

type KocCardProps = {
  koc: Koc;
  onEdit: (koc: Koc) => void;
  onDelete: (koc: Koc) => void;
};

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
};

const formatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return "N/A";
  if (num < 1000) return num.toString();
  if (num < 1000000) return (num / 1000).toFixed(1).replace('.0', '') + "K";
  if (num < 1000000000) return (num / 1000000).toFixed(1).replace('.0', '') + "M";
  return (num / 1000000000).toFixed(1).replace('.0', '') + "B";
};

export const KocCard = ({ koc, onEdit, onDelete }: KocCardProps) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const loadingToastId = useRef<string | number | null>(null);

  const scanKocMutation = useMutation({
    mutationFn: async (kocId: string) => {
      if (!koc.channel_url) {
        throw new Error("KOC không có link kênh để quét.");
      }
      const { data, error } = await supabase.functions.invoke("scan-single-koc", {
        body: { kocId },
      });
      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      return data;
    },
    onMutate: () => {
      loadingToastId.current = showLoading("Đang quét kênh, vui lòng chờ...");
    },
    onSuccess: () => {
      if (loadingToastId.current) {
        dismissToast(loadingToastId.current);
      }
      showSuccess("Quét kênh thành công! Dữ liệu đã được cập nhật.");
      queryClient.invalidateQueries({ queryKey: ["kocs", user?.id] });
    },
    onError: (error: Error) => {
      if (loadingToastId.current) {
        dismissToast(loadingToastId.current);
      }
      showError(`Lỗi khi quét kênh: ${error.message}`);
    },
  });

  return (
    <Card className="relative flex flex-col hover:shadow-lg transition-shadow duration-300">
      <Link
        to={`/list-koc/${koc.id}`}
        className="absolute inset-0 z-0"
        aria-label={`View details for ${koc.name}`}
      />
      <CardHeader className="flex flex-row items-start justify-between p-4 space-x-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar className="h-12 w-12 border-2 border-white shadow-sm flex-shrink-0">
            <AvatarImage src={koc.avatar_url || undefined} alt={koc.name} />
            <AvatarFallback>{getInitials(koc.name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold truncate">{koc.name}</h3>
            {koc.field && (
              <Badge variant="secondary" className="mt-1 font-normal text-xs">
                <Tag className="mr-1 h-3 w-3" />
                {koc.field}
              </Badge>
            )}
          </div>
        </div>
        <div className="relative z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0 flex-shrink-0"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  scanKocMutation.mutate(koc.id);
                }}
                disabled={!koc.channel_url || scanKocMutation.isPending}
              >
                {scanKocMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ScanLine className="mr-2 h-4 w-4" />
                )}
                <span>{scanKocMutation.isPending ? "Đang quét..." : "Quét kênh"}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(koc); }}>
                <Edit className="mr-2 h-4 w-4" />
                <span>Chỉnh sửa</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDelete(koc); }}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Xóa</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 flex-grow flex flex-col justify-between">
        <div className="space-y-2 mb-4 text-sm text-muted-foreground">
          {koc.channel_url && (
            <a
              href={koc.channel_url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 flex items-center gap-2 hover:text-primary transition-colors"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <LinkIcon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate" title={koc.channel_url}>
                Xem kênh
              </span>
            </a>
          )}
          <div className="relative z-10 flex items-center gap-2">
            <Clapperboard className="h-4 w-4 flex-shrink-0" />
            <span>{koc.generated_video_count || 0} video đã tạo</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center border-t pt-4">
          <div className="flex flex-col items-center space-y-1">
            <Users className="h-5 w-5 text-blue-500" />
            <p className="text-sm font-bold text-foreground">{formatNumber(koc.follower_count)}</p>
            <p className="text-xs text-muted-foreground">Followers</p>
          </div>
          <div className="flex flex-col items-center space-y-1">
            <Heart className="h-5 w-5 text-red-500" />
            <p className="text-sm font-bold text-foreground">{formatNumber(koc.like_count)}</p>
            <p className="text-xs text-muted-foreground">Likes</p>
          </div>
          <div className="flex flex-col items-center space-y-1">
            <Video className="h-5 w-5 text-green-500" />
            <p className="text-sm font-bold text-foreground">{formatNumber(koc.video_count)}</p>
            <p className="text-xs text-muted-foreground">Videos</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};