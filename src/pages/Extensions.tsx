import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Copy, Trash2, Plug } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { showSuccess, showError } from "@/utils/toast";
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
import { CreateExtensionDialog } from "@/components/extensions/CreateExtensionDialog";

export type ExtensionInstance = {
  id: string;
  name: string;
  created_at: string;
};

const fetchExtensions = async () => {
  const { data, error } = await supabase
    .from("extension_instances")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
};

const Extensions = () => {
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [selectedExtension, setSelectedExtension] = useState<ExtensionInstance | null>(null);
  const queryClient = useQueryClient();

  const { data: extensions, isLoading } = useQuery<ExtensionInstance[]>({
    queryKey: ["extensions"],
    queryFn: fetchExtensions,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("extension_instances").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Xóa Extension thành công!");
      queryClient.invalidateQueries({ queryKey: ["extensions"] });
      setDeleteOpen(false);
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
    },
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess("Đã sao chép vào clipboard!");
  };

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Quản lý Extensions</h1>
            <p className="text-muted-foreground mt-1">Kết nối và quản lý các trình duyệt của bạn.</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="bg-red-600 hover:bg-red-700 text-white">
            <Plus className="mr-2 h-4 w-4" /> Thêm Extension
          </Button>
        </header>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
          </div>
        ) : extensions && extensions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {extensions.map((ext) => (
              <Card key={ext.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plug className="text-red-500" />
                    {ext.name}
                  </CardTitle>
                  <CardDescription>
                    Kết nối ngày: {new Date(ext.created_at).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Mã kết nối</label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          readOnly
                          value={ext.id}
                          className="flex-grow bg-muted text-muted-foreground text-sm rounded-md px-3 py-2 border font-mono"
                        />
                        <Button variant="outline" size="icon" onClick={() => handleCopy(ext.id)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex justify-end">
                       <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setSelectedExtension(ext);
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Xóa
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <h3 className="text-xl font-semibold text-gray-700">Chưa có Extension nào được kết nối</h3>
            <p className="text-gray-500 mt-2 mb-4">Bắt đầu bằng cách thêm Extension đầu tiên của bạn.</p>
            <Button onClick={() => setCreateOpen(true)} className="bg-red-600 hover:bg-red-700 text-white">
              <Plus className="h-4 w-4 mr-2" /> Thêm Extension
            </Button>
          </div>
        )}
      </div>

      <CreateExtensionDialog isOpen={isCreateOpen} onOpenChange={setCreateOpen} />

      <AlertDialog open={isDeleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này sẽ ngắt kết nối Extension "{selectedExtension?.name}". Bạn sẽ cần kết nối lại bằng mã mới.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedExtension && deleteMutation.mutate(selectedExtension.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Đang xóa..." : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Extensions;