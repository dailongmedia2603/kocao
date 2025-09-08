import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, Trash2, Edit, Mic, PlayCircle, Loader2, Inbox, Link as LinkIcon, Users, FileText as FileTextIcon, Calendar, Activity, Settings2 } from "lucide-react";
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ViewPostContentDialog } from "./ViewPostContentDialog";
import { showSuccess, showError } from "@/utils/toast";

type NewsPost = {
  id: string;
  source_name: string | null;
  content: string | null;
  created_time: string;
  status: string;
  voice_script: string | null;
  post_url: string | null;
};

interface NewsTableProps {
  news: NewsPost[];
  isLoading: boolean;
}

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

export const NewsTable = ({ news, isLoading }: NewsTableProps) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [isContentDialogOpen, setIsContentDialogOpen] = useState(false);
  const [selectedPostContent, setSelectedPostContent] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<NewsPost | null>(null);

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from('news_posts').delete().eq('id', postId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Xóa bài viết thành công!");
      queryClient.invalidateQueries({ queryKey: ['news_posts', user?.id] });
      setPostToDelete(null);
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
      setPostToDelete(null);
    },
  });

  const handleViewContent = (content: string | null) => {
    if (content) {
      setSelectedPostContent(content);
      setIsContentDialogOpen(true);
    }
  };

  const handleDelete = () => {
    if (postToDelete) {
      deletePostMutation.mutate(postToDelete.id);
    }
  };

  return (
    <>
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><div className="flex items-center gap-2"><Users className="h-4 w-4" />Nguồn</div></TableHead>
              <TableHead><div className="flex items-center gap-2"><FileTextIcon className="h-4 w-4" />Nội dung post</div></TableHead>
              <TableHead><div className="flex items-center gap-2"><Calendar className="h-4 w-4" />Ngày post</div></TableHead>
              <TableHead><div className="flex items-center gap-2"><LinkIcon className="h-4 w-4" />Link bài</div></TableHead>
              <TableHead><div className="flex items-center gap-2"><Activity className="h-4 w-4" />Trạng thái</div></TableHead>
              <TableHead><div className="flex items-center gap-2"><Mic className="h-4 w-4" />Kịch bản voice</div></TableHead>
              <TableHead className="text-right"><div className="flex items-center justify-end gap-2"><Settings2 className="h-4 w-4" />Hành động</div></TableHead>
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
              news.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <span className="font-medium">{item.source_name || 'Không rõ'}</span>
                  </TableCell>
                  <TableCell>
                    <p 
                      className="max-w-xs truncate cursor-pointer hover:text-primary" 
                      title="Bấm để xem đầy đủ"
                      onClick={() => handleViewContent(item.content)}
                    >
                      {item.content}
                    </p>
                  </TableCell>
                  <TableCell>{format(new Date(item.created_time), 'dd/MM/yyyy', { locale: vi })}</TableCell>
                  <TableCell>
                    {item.post_url && (
                      <a href={item.post_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="icon" className="h-8 w-8">
                          <LinkIcon className="h-4 w-4" />
                        </Button>
                      </a>
                    )}
                  </TableCell>
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
                        <DropdownMenuItem onClick={() => alert('Chức năng đang được phát triển')}>
                          <Edit className="mr-2 h-4 w-4" />
                          <span>Sửa</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => setPostToDelete(item)}>
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
      <ViewPostContentDialog 
        isOpen={isContentDialogOpen}
        onOpenChange={setIsContentDialogOpen}
        content={selectedPostContent}
      />
      <AlertDialog open={!!postToDelete} onOpenChange={(isOpen) => !isOpen && setPostToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Bài viết sẽ bị xóa vĩnh viễn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deletePostMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletePostMutation.isPending ? "Đang xóa..." : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};