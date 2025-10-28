import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MoreHorizontal, Edit, Trash2, Lightbulb, Loader2, Video, Settings, History, Wand2 } from "lucide-react";
import { AddEditIdeaDialog } from "./AddEditIdeaDialog";
import { showSuccess, showError } from "@/utils/toast";
import { ViewScriptContentDialog } from "@/components/content/ViewScriptContentDialog";
import { ConfigureAiTemplatesDialog } from "@/components/automation/ConfigureAiTemplatesDialog";
import { IdeaLogDialog } from "./IdeaLogDialog";
import { useSession } from "@/contexts/SessionContext";

type Idea = {
  id: string;
  idea_content: string;
  new_content: string | null;
  status: string;
  created_at: string;
  koc_files: {
    display_name: string;
    url: string;
  } | null;
};

type IdeaContentTabProps = {
  kocId: string;
  ideas: Idea[] | undefined;
  isLoading: boolean;
};

const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case 'Đã tạo video':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Đã tạo video</Badge>;
    case 'Đã có content':
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Đã có content</Badge>;
    case 'Đang xử lý':
    case 'Đang tạo voice':
    case 'Đang tạo video':
      return (
        <Badge variant="outline" className="text-yellow-800 border-yellow-200">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          {status}
        </Badge>
      );
    case 'Lỗi tạo video':
      return <Badge variant="destructive">Lỗi tạo video</Badge>;
    case 'Chưa sử dụng':
    default:
      return <Badge variant="secondary">Chưa sử dụng</Badge>;
  }
};

export const IdeaContentTab = ({ kocId, ideas, isLoading }: IdeaContentTabProps) => {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const [isAddEditOpen, setAddEditOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [isViewContentOpen, setViewContentOpen] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [contentToView, setContentToView] = useState<string | null>(null);
  const [isConfigureOpen, setConfigureOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);

  const queryKey = ["koc_content_ideas", kocId];

  // Realtime Subscription
  useEffect(() => {
    if (!user || !kocId) return;

    const channel = supabase
      .channel(`koc_content_ideas_changes_${kocId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'koc_content_ideas',
          filter: `koc_id=eq.${kocId}`
        },
        (payload) => {
          console.log('Idea content change received!', payload);
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, kocId, queryClient, queryKey]);


  const deleteMutation = useMutation({
    mutationFn: async (ideaId: string) => {
      const { error } = await supabase.from("koc_content_ideas").delete().eq("id", ideaId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Xóa idea thành công!");
      queryClient.invalidateQueries({ queryKey });
      setDeleteOpen(false);
      setSelectedIdea(null);
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
    },
  });

  const generateContentMutation = useMutation({
    mutationFn: async (ideaId: string) => {
        const { error } = await supabase.functions.invoke("generate-idea-content", {
            body: { ideaId },
        });
        if (error) throw new Error(error.message);
    },
    onMutate: async (ideaId: string) => {
        await queryClient.cancelQueries({ queryKey });
        const previousIdeas = queryClient.getQueryData<Idea[]>(queryKey);
        
        queryClient.setQueryData<Idea[]>(queryKey, (old) =>
            old ? old.map(idea => idea.id === ideaId ? { ...idea, status: 'Đang xử lý' } : idea) : []
        );

        showSuccess("Đã gửi yêu cầu tạo content. Vui lòng chờ trong giây lát.");
        return { previousIdeas };
    },
    onError: (err: Error, ideaId, context: any) => {
        if (context?.previousIdeas) {
            queryClient.setQueryData(queryKey, context.previousIdeas);
        }
        showError(`Lỗi tạo content: ${err.message}`);
    },
    onSettled: () => {
        queryClient.invalidateQueries({ queryKey });
    },
  });

  const handleAddNew = () => {
    setSelectedIdea(null);
    setAddEditOpen(true);
  };

  const handleEdit = (idea: Idea) => {
    setSelectedIdea(idea);
    setAddEditOpen(true);
  };

  const handleDelete = (idea: Idea) => {
    setSelectedIdea(idea);
    setDeleteOpen(true);
  };

  const handleViewContent = (content: string | null) => {
    setContentToView(content);
    setViewContentOpen(true);
  };

  const handleGenerateNow = (idea: Idea) => {
    generateContentMutation.mutate(idea.id);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Danh sách Idea Content</CardTitle>
            <CardDescription>Quản lý các ý tưởng và nội dung đã phát triển cho KOC.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setIsLogOpen(true)}>
              <History className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => setConfigureOpen(true)}>
              <Settings className="mr-2 h-4 w-4" /> Cấu hình AI
            </Button>
            <Button onClick={handleAddNew}>
              <Plus className="mr-2 h-4 w-4" /> Thêm mới
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Idea Content</TableHead>
                <TableHead>Content mới</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Video đã tạo</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : ideas && ideas.length > 0 ? (
                ideas.map((idea) => (
                  <TableRow key={idea.id}>
                    <TableCell className="font-medium max-w-xs truncate">{idea.idea_content}</TableCell>
                    <TableCell>
                      {idea.new_content ? (
                        <Button variant="link" className="p-0 h-auto" onClick={() => handleViewContent(idea.new_content)}>Xem</Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">Chưa có</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={idea.status} />
                    </TableCell>
                    <TableCell>
                      {idea.koc_files ? (
                        <a href={idea.koc_files.url} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-600 hover:underline">
                          <Video className="mr-2 h-4 w-4" />
                          <span className="truncate max-w-[150px]">{idea.koc_files.display_name}</span>
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-xs">Chưa có</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(idea.status === 'Chưa sử dụng' || !idea.new_content) && (
                            <DropdownMenuItem 
                              onClick={() => handleGenerateNow(idea)} 
                              disabled={generateContentMutation.isPending}
                            >
                              <Wand2 className="mr-2 h-4 w-4" /> Tạo ngay
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleEdit(idea)}>
                            <Edit className="mr-2 h-4 w-4" /> Sửa
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(idea)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Xóa
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <Lightbulb className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2">Chưa có idea content nào.</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AddEditIdeaDialog
        isOpen={isAddEditOpen}
        onOpenChange={setAddEditOpen}
        kocId={kocId}
        idea={selectedIdea}
      />

      <AlertDialog open={isDeleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
            <AlertDialogDescription>Hành động này không thể hoàn tác. Idea content sẽ bị xóa vĩnh viễn.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedIdea(null)}>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedIdea && deleteMutation.mutate(selectedIdea.id)} disabled={deleteMutation.isPending} className="bg-destructive hover:bg-destructive/90">
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ViewScriptContentDialog
        isOpen={isViewContentOpen}
        onOpenChange={setViewContentOpen}
        title="Content mới"
        content={contentToView}
      />
      <ConfigureAiTemplatesDialog isOpen={isConfigureOpen} onOpenChange={setConfigureOpen} />
      <IdeaLogDialog isOpen={isLogOpen} onOpenChange={setIsLogOpen} kocId={kocId} />
    </>
  );
};