import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Plus, FileText, Search, Filter } from "lucide-react";
import { CreateKocDialog } from "@/components/koc/CreateKocDialog";
import { EditKocDialog } from "@/components/koc/EditKocDialog";
import { DeleteKocDialog } from "@/components/koc/DeleteKocDialog";
import { showSuccess, showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { KocCard } from "@/components/koc/KocCard";

type Koc = {
  id: string;
  name: string;
  field: string | null;
  avatar_url: string | null;
  folder_path: string | null;
};

const ListKoc = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedKoc, setSelectedKoc] = useState<Koc | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedField, setSelectedField] = useState<string | null>(null);

  const { data: kocs, isLoading } = useQuery({
    queryKey: ["kocs", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("kocs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!user,
  });

  const uniqueFields = useMemo(() => {
    if (!kocs) return [];
    return [...new Set(kocs.map((koc) => koc.field).filter(Boolean) as string[])];
  }, [kocs]);

  const filteredKocs = useMemo(() => {
    if (!kocs) return [];
    return kocs.filter((koc) => {
      const nameMatch = koc.name.toLowerCase().includes(searchTerm.toLowerCase());
      const fieldMatch = selectedField ? koc.field === selectedField : true;
      return nameMatch && fieldMatch;
    });
  }, [kocs, searchTerm, selectedField]);

  const deleteKocMutation = useMutation({
    mutationFn: async (koc: Koc) => {
      if (!koc.folder_path) {
        throw new Error("Không tìm thấy đường dẫn thư mục.");
      }
      const { error: functionError } = await supabase.functions.invoke("delete-r2-folder", {
        body: { folderPath: koc.folder_path },
      });
      if (functionError) throw new Error(`Lỗi xóa thư mục R2: ${functionError.message}`);
      const { error: dbError } = await supabase.from("kocs").delete().eq("id", koc.id);
      if (dbError) throw new Error(`Lỗi xóa KOC khỏi database: ${dbError.message}`);
    },
    onSuccess: () => {
      showSuccess("Xóa KOC thành công!");
      queryClient.invalidateQueries({ queryKey: ["kocs", user?.id] });
      setIsDeleteDialogOpen(false);
      setSelectedKoc(null);
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const handleEdit = (koc: Koc) => {
    setSelectedKoc(koc);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (koc: Koc) => {
    setSelectedKoc(koc);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedKoc) {
      deleteKocMutation.mutate(selectedKoc);
    }
  };

  return (
    <>
      <div className="p-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">KOCs Manager</h1>
        </div>
        <div className="flex items-center justify-between mb-8 p-4 bg-white rounded-lg shadow-sm border">
           <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Tìm theo tên KOC..."
                className="pl-10 w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  {selectedField || "Lĩnh vực"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setSelectedField(null)}>Tất cả lĩnh vực</DropdownMenuItem>
                {uniqueFields.length > 0 && <DropdownMenuSeparator />}
                {uniqueFields.map((field) => (
                  <DropdownMenuItem key={field} onSelect={() => setSelectedField(field)}>
                    {field}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-red-600 hover:bg-red-700 text-white">
            <Plus className="mr-2 h-4 w-4" />
            Tạo KOC mới
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        ) : filteredKocs && filteredKocs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredKocs.map((koc) => (
              <KocCard key={koc.id} koc={koc} onEdit={handleEdit} onDelete={handleDelete} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">Không tìm thấy KOC nào</h3>
            <p className="mt-1 text-sm text-gray-500">Hãy thử tìm kiếm hoặc lọc với từ khóa khác, hoặc tạo một KOC mới.</p>
            <div className="mt-6">
              <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-red-600 hover:bg-red-700 text-white">
                <Plus className="mr-2 h-4 w-4" />
                Tạo KOC mới
              </Button>
            </div>
          </div>
        )}
      </div>

      <CreateKocDialog isOpen={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
      <EditKocDialog isOpen={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} koc={selectedKoc} />
      <DeleteKocDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={confirmDelete}
        isPending={deleteKocMutation.isPending}
      />
    </>
  );
};

export default ListKoc;