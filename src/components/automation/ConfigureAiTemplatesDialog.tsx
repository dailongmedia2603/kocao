import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { showSuccess, showError } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MoreHorizontal, Edit, Trash2, CheckCircle, Star, Loader2 } from "lucide-react";
import { AddEditPromptTemplateDialog } from "./AddEditPromptTemplateDialog";

type PromptTemplate = {
  id: string;
  name: string;
  is_default: boolean;
  model?: string | null;
  word_count?: number | null;
};

type ConfigureAiTemplatesDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export const ConfigureAiTemplatesDialog = ({ isOpen, onOpenChange }: ConfigureAiTemplatesDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const [isAddEditOpen, setAddEditOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);

  const queryKey = ["ai_prompt_templates", user?.id];

  const { data: templates = [], isLoading } = useQuery<PromptTemplate[]>({
    queryKey,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("ai_prompt_templates").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && isOpen,
  });

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase.from("ai_prompt_templates").delete().eq("id", templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Xóa template thành công!");
      queryClient.invalidateQueries({ queryKey });
      setDeleteOpen(false);
      setSelectedTemplate(null);
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase.rpc('set_default_prompt_template', { template_id_to_set: templateId });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Đặt làm template mặc định thành công!");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  const handleAddNew = () => {
    setSelectedTemplate(null);
    setAddEditOpen(true);
  };

  const handleEdit = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    setAddEditOpen(true);
  };

  const handleDelete = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    setDeleteOpen(true);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle>Quản lý Template AI</DialogTitle>
                <DialogDescription>Tạo, chỉnh sửa và chọn template mặc định cho các chiến dịch automation của bạn.</DialogDescription>
              </div>
              <Button onClick={handleAddNew} className="flex-shrink-0"><Plus className="mr-2 h-4 w-4" /> Thêm Template mới</Button>
            </div>
          </DialogHeader>
          <div className="pt-4">
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {isLoading ? (
                [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
              ) : templates.length > 0 ? (
                templates.map((template) => (
                  <Card key={template.id} className={template.is_default ? "border-primary" : ""}>
                    <CardHeader className="flex flex-row items-start justify-between p-4">
                      <div>
                        <CardTitle className="flex items-center gap-2">{template.name}{template.is_default && <Badge variant="default" className="bg-green-600"><CheckCircle className="mr-1 h-3 w-3" /> Mặc định</Badge>}</CardTitle>
                        <CardDescription className="text-xs mt-1">Model: {template.model || 'N/A'} | Tối đa: {template.word_count || 'N/A'} từ</CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(template)}><Edit className="mr-2 h-4 w-4" /> Sửa</DropdownMenuItem>
                          {!template.is_default && <DropdownMenuItem onClick={() => setDefaultMutation.mutate(template.id)}><Star className="mr-2 h-4 w-4" /> Đặt làm mặc định</DropdownMenuItem>}
                          <DropdownMenuItem onClick={() => handleDelete(template)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Xóa</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardHeader>
                  </Card>
                ))
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Chưa có template nào.</p>
                  <p className="text-sm">Hãy tạo template đầu tiên của bạn!</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AddEditPromptTemplateDialog isOpen={isAddEditOpen} onOpenChange={setAddEditOpen} template={selectedTemplate} />

      <AlertDialog open={isDeleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
            <AlertDialogDescription>Hành động này không thể hoàn tác. Template "{selectedTemplate?.name}" sẽ bị xóa vĩnh viễn.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedTemplate(null)}>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedTemplate && deleteMutation.mutate(selectedTemplate.id)} disabled={deleteMutation.isPending} className="bg-destructive hover:bg-destructive/90">
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};