import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MoreHorizontal, Edit, Trash2, Lightbulb, Loader2, Video } from "lucide-react";
import { AddEditIdeaDialog } from "./AddEditIdeaDialog";
import { showSuccess, showError } from "@/utils/toast";
import { ViewScriptContentDialog } from "@/components/content/ViewScriptContentDialog";

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

export const IdeaContentTab = ({ kocId, ideas, isLoading }: IdeaContentTabProps) => {
  const queryClient = useQueryClient();
  const [isAddEditOpen, setAddEditOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [isViewContentOpen, setViewContentOpen] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [contentToView, setContentToView] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (ideaId: string) => {
      const { error } = await supabase.from("koc_content_ideas").delete().eq("id", ideaId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Xóa idea thành công!");
      queryClient.invalidateQueries({ queryKey: ["koc_content_ideas", kocId] });
      setDeleteOpen(false);
      setSelectedIdea(null);
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
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

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Danh sách Idea Content</CardTitle>
            <CardDescription>Quản lý các ý tưởng và nội dung đã phát triển cho KOC.</CardDescription>
          </div>
          <Button onClick={handleAddNew}>
            <Plus className="mr-2 h-4 w-4" /> Thêm mới
          </Button>
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
                      <Badge variant={idea.status === 'Đã tạo video' ? 'default' : 'secondary'}>
                        {idea.status}
                      </Badge>
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
    </>
  );
};