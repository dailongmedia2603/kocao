import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertCircle,
  Plus,
  UserSquare2,
  Search,
  ChevronDown,
} from "lucide-react";
import { CreateKocDialog } from "@/components/koc/CreateKocDialog";
import { EditKocDialog } from "@/components/koc/EditKocDialog";
import { DeleteKocDialog } from "@/components/koc/DeleteKocDialog";
import { showSuccess, showError } from "@/utils/toast";
import { KocCard } from "@/components/koc/KocCard";

type Koc = {
  id: string;
  name: string;
  field: string | null;
  avatar_url: string | null;
  folder_path: string | null;
};

const fetchKocs = async (userId: string): Promise<Koc[]> => {
  const { data, error } = await supabase
    .from("kocs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
};

const ListKoc = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isEditOpen, setEditOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [selectedKoc, setSelectedKoc] = useState<Koc | null>(null);

  const {
    data: kocs,
    isLoading,
    isError,
    error,
  } = useQuery<Koc[]>({
    queryKey: ["kocs", user?.id],
    queryFn: () => fetchKocs(user!.id),
    enabled: !!user,
  });

  const deleteKocMutation = useMutation({
    mutationFn: async (kocToDelete: Koc) => {
      // Nếu có đường dẫn thư mục, hãy xóa nó trước
      if (kocToDelete.folder_path) {
        const { error: functionError } = await supabase.functions.invoke(
          "delete-r2-folder",
          {
            body: { folderPath: kocToDelete.folder_path },
          }
        );
        if (functionError)
          throw new Error(`Lỗi xóa thư mục R2: ${functionError.message}`);
      }

      // Luôn xóa KOC khỏi cơ sở dữ liệu
      const { error: dbError } = await supabase
        .from("kocs")
        .delete()
        .eq("id", kocToDelete.id);
      if (dbError) throw new Error(`Lỗi xóa KOC: ${dbError.message}`);
    },
    onSuccess: () => {
      showSuccess("Xóa KOC thành công!");
      queryClient.invalidateQueries({ queryKey: ["kocs", user?.id] });
      setDeleteOpen(false);
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const handleEdit = (koc: Koc) => {
    setSelectedKoc(koc);
    setEditOpen(true);
  };

  const handleDelete = (koc: Koc) => {
    setSelectedKoc(koc);
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (selectedKoc) {
      deleteKocMutation.mutate(selectedKoc);
    }
  };

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <h1 className="text-3xl font-bold text-gray-800">KOCs</h1>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="mr-2 h-4 w-4" /> Create KOC
          </Button>
        </header>

        <Card className="p-4 mb-6">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div className="relative flex-grow sm:flex-grow-0 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search KOCs" className="pl-9 bg-white" />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="bg-white">
                Status <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" className="bg-white">
                Platform <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" className="bg-white">
                Category <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-56 w-full rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Lỗi</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : kocs && kocs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {kocs.map((koc) => (
              <KocCard
                key={koc.id}
                koc={koc}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <UserSquare2 className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-xl font-semibold text-gray-700">
              Chưa có KOC nào
            </h3>
            <p className="text-gray-500 mt-2 mb-4">
              Bắt đầu bằng cách thêm KOC đầu tiên của bạn.
            </p>
            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" /> Thêm KOC
            </Button>
          </div>
        )}
      </div>
      <CreateKocDialog isOpen={isCreateOpen} onOpenChange={setCreateOpen} />
      <EditKocDialog
        isOpen={isEditOpen}
        onOpenChange={setEditOpen}
        koc={selectedKoc}
      />
      <DeleteKocDialog
        isOpen={isDeleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={confirmDelete}
        isPending={deleteKocMutation.isPending}
      />
    </>
  );
};

export default ListKoc;