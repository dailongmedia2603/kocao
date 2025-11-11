import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { showSuccess, showError } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MoreHorizontal, Edit, Trash2, Check, Star, Lightbulb, Loader2, User, Shield } from "lucide-react";
import { AddEditAiTemplateDialog } from "./AddEditAiTemplateDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type Template = {
  id: string;
  name: string;
  model: string | null;
  word_count: number | null;
  is_default: boolean;
  user_id: string;
  is_public: boolean;
  [key: string]: any; 
};

type ConfigureAiTemplatesDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  kocId: string;
  defaultTemplateIdForKoc: string | null;
};

export const ConfigureAiTemplatesDialog = ({ isOpen, onOpenChange, kocId, defaultTemplateIdForKoc }: ConfigureAiTemplatesDialogProps) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [isAddEditOpen, setAddEditOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  const queryKey = ["available_ai_prompt_templates", user?.id];

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.rpc('get_available_prompt_templates');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && isOpen,
  });

  const { userTemplates, adminTemplates } = useMemo(() => {
    const userT: Template[] = [];
    const adminT: Template[] = [];
    templates.forEach(t => {
      if (t.user_id === user?.id) {
        userT.push(t);
      } else {
        adminT.push(t);
      }
    });
    return { userTemplates: userT, adminTemplates: adminT };
  }, [templates, user?.id]);

  const setDefaultMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase.rpc('set_default_prompt_for_koc', {
        p_koc_id: kocId,
        p_template_id: templateId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Đặt template mặc định cho KOC này thành công!");
      queryClient.invalidateQueries({ queryKey: ["koc", kocId] });
      queryClient.invalidateQueries({ queryKey: ["onboarding_kocs", user?.id] });
    },
    onError: (error: Error) => showError(error.message),
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
    },
    onError: (error: Error) => showError(error.message),
  });

  const handleAddNew = () => {
    setSelectedTemplate(null);
    setAddEditOpen(true);
  };

  const handleEdit = (template: Template) => {
    setSelectedTemplate(template);
    setAddEditOpen(true);
  };

  const handleDelete = (template: Template) => {
    setSelectedTemplate(template);
    setDeleteOpen(true);
  };

  const TemplateCard = ({ template, isUserTemplate }: { template: Template, isUserTemplate: boolean }) => {
    const isDefaultForKoc = template.id === defaultTemplateIdForKoc;
    return (
      <Card className="border-2 border-transparent data-[default=true]:border-green-500 transition-colors" data-default={isDefaultForKoc}>
        <CardContent className="p-4">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold">{template.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Model: {template.model || 'N/A'} | Tối đa: {template.word_count || 'N/A'} từ
              </p>
            </div>
            
            <div className="flex items-center gap-1 flex-shrink-0">
              {isDefaultForKoc ? (
                <div className="bg-green-600 text-white rounded-md px-3 py-1 text-xs font-semibold flex items-center h-8">
                  <Check className="h-3 w-3 mr-1" /> Mặc định
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setDefaultMutation.mutate(template.id)}
                  disabled={setDefaultMutation.isPending && setDefaultMutation.variables === template.id}
                >
                  {setDefaultMutation.isPending && setDefaultMutation.variables === template.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Star className="mr-2 h-4 w-4" />
                  )}
                  Đặt làm mặc định
                </Button>
              )}
              
              {isUserTemplate && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(template)}>
                      <Edit className="mr-2 h-4 w-4" /> Sửa
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(template)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Xóa
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <DialogTitle className="text-2xl font-bold">Quản lý Template AI</DialogTitle>
                <DialogDescription className="mt-1">
                  Quản lý các prompt mẫu để tự động tạo kịch bản.
                </DialogDescription>
              </div>
              <Button onClick={handleAddNew} className="w-full sm:w-auto bg-red-600 hover:bg-red-700">
                <Plus className="mr-2 h-4 w-4" /> Thêm Template mới
              </Button>
            </div>
          </DialogHeader>
          <div className="mt-4 space-y-6 max-h-[60vh] overflow-y-auto pr-2 -mr-2">
            {isLoading ? (
              [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
            ) : (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center"><User className="h-4 w-4 mr-2" />Template của bạn</h3>
                  {userTemplates.length > 0 ? (
                    <div className="space-y-3">
                      {userTemplates.map((template) => <TemplateCard key={template.id} template={template} isUserTemplate={true} />)}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-24 text-muted-foreground border-2 border-dashed rounded-lg">
                      <Lightbulb className="h-8 w-8" />
                      <p className="mt-2 text-sm">Bạn chưa có template nào.</p>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center"><Shield className="h-4 w-4 mr-2" />Thư viện mẫu (Admin)</h3>
                  {adminTemplates.length > 0 ? (
                    <div className="space-y-3">
                      {adminTemplates.map((template) => <TemplateCard key={template.id} template={template} isUserTemplate={false} />)}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-24 text-muted-foreground border-2 border-dashed rounded-lg">
                      <p className="text-sm">Không có template nào từ admin.</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AddEditAiTemplateDialog
        isOpen={isAddEditOpen}
        onOpenChange={setAddEditOpen}
        template={selectedTemplate}
      />

      <AlertDialog open={isDeleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
            <AlertDialogDescription>Hành động này không thể hoàn tác. Template sẽ bị xóa vĩnh viễn.</AlertDialogDescription>
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