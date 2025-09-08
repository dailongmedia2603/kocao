import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Edit, Mic, PlayCircle, Loader2, Inbox } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

type NewsPost = {
  id: string;
  source_name: string | null;
  content: string | null;
  created_time: string;
  status: string;
  voice_script: string | null;
};

const fetchNewsPosts = async (userId: string) => {
  const { data, error } = await supabase
    .from('news_posts')
    .select('id, source_name, content, created_time, status, voice_script')
    .eq('user_id', userId)
    .order('created_time', { ascending: false })
    .limit(50);
  
  if (error) throw error;
  return data as NewsPost[];
};

const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case "new":
      return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">Mới</Badge>;
    case "voice_generated":
      return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">Đã tạo voice</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

export const NewsTable = () => {
  const { user } = useSession();
  const { data: news, isLoading } = useQuery({
    queryKey: ['news_posts', user?.id],
    queryFn: () => fetchNewsPosts(user!.id),
    enabled: !!user,
  });

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">STT</TableHead>
            <TableHead>Nguồn</TableHead>
            <TableHead>Nội dung post</TableHead>
            <TableHead>Ngày post</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Kịch bản voice</TableHead>
            <TableHead className="text-right">Hành động</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="h-48 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Đang tải tin tức...</p>
              </TableCell>
            </TableRow>
          ) : news && news.length > 0 ? (
            news.map((item, index) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell>
                  <span className="font-medium">{item.source_name || 'Không rõ'}</span>
                </TableCell>
                <TableCell>
                  <p className="max-w-xs truncate" title={item.content || ''}>
                    {item.content}
                  </p>
                </TableCell>
                <TableCell>{formatDistanceToNow(new Date(item.created_time), { addSuffix: true, locale: vi })}</TableCell>
                <TableCell>
                  <StatusBadge status={item.status} />
                </TableCell>
                <TableCell>
                  {item.voice_script ? (
                    <Button variant="outline" size="sm">
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Xem kịch bản
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm">
                      <Mic className="mr-2 h-4 w-4" />
                      Tạo voice
                    </Button>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Mở menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Edit className="mr-2 h-4 w-4" />
                        <span>Sửa</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600">
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Xóa</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="h-48 text-center">
                <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 font-medium">Không có tin tức nào</p>
                <p className="text-sm text-muted-foreground">Hãy cấu hình nguồn để bắt đầu quét tin tức.</p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};