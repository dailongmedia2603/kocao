import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { showSuccess, showError } from "@/utils/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit, Trash2, CheckCircle, Wand2, MoreHorizontal, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CreateOrEditPromptTemplateDialog } from "./CreateOrEditPromptTemplateDialog";

type Template = {
  id: string;
  name: string;
  is_default: boolean;
  [key: string]: any;
};

const AiPromptSettings = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  const { data: templates, isLoading } = useQuery<Template[]>({
    queryKey: ['ai_prompt_templates', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('ai_prompt_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase.rpc('set_default_prompt_template', { template_id_to_set: templateId });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Đã đặt mẫu làm mặc định.");
      queryClient.invalidateQueries({ queryKey: ['ai_prompt_templates', user?.id] });
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase.from('ai_prompt_templates').delete().eq('id', templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Đã xóa mẫu.");
      queryClient.invalidateQueries({ queryKey: ['ai_prompt_templates', user?.id] });
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  const handleCreate = () => {
    setEditingTemplate(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setIsDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Quản lý Mẫu Prompt</CardTitle>
            <CardDescription>Tạo, sửa và chọn mẫu prompt mặc định cho hệ thống automation.</CardDescription>
          </div>
          <Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" /> Tạo mẫu mới</Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : templates && templates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((template) => (
                <Card key={template.id} className={template.is_default ? "border-primary" : ""}>
                  <CardHeader className="flex flex-row items-start justify-between pb-2">
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      {template.is_default && <Badge className="mt-2"><CheckCircle className="mr-1 h-3 w-3" />Mặc định</Badge>}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(template)}><Edit className="mr-2 h-4 w-4" />Sửa</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDefaultMutation.mutate(template.id)} disabled={template.is_default || setDefaultMutation.isPending}><CheckCircle className="mr-2 h-4 w-4" />Đặt làm mặc định</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deleteMutation.mutate(template.id)} disabled={deleteMutation.isPending} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Xóa</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      Model: {template.model || 'N/A'} | Số từ: {template.word_count || 'N/A'} | Tông giọng: {template.tone_of_voice || 'N/A'}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 border-2 border-dashed rounded-lg">
              <Wand2 className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">Chưa có mẫu prompt nào</h3>
              <p className="mt-1 text-sm text-muted-foreground">Bấm "Tạo mẫu mới" để bắt đầu.</p>
            </div>
          )}
        </CardContent>
      </Card>
      <CreateOrEditPromptTemplateDialog isOpen={isDialogOpen} onOpenChange={setIsDialogOpen} template={editingTemplate} />
    </>
  );
};

export default AiPromptSettings;