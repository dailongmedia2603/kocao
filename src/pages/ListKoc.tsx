import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Icons
import { Plus, AlertCircle } from "lucide-react";

// Custom Components
import { CreateKocDialog } from "@/components/koc/CreateKocDialog";
import { EditKocDialog } from "@/components/koc/EditKocDialog";
import { DeleteKocDialog } from "@/components/koc/DeleteKocDialog";
import { KocCard } from "@/components/koc/KocCard";

type Koc = {
  id: string;
  name: string;
  field: string | null;
  avatar_url: string | null;
  created_at: string;
  channel_url: string | null;
  folder_path: string | null;
  video_count: number;
};

const fetchKocs = async (userId: string) => {
  const { data, error } = await supabase
    .rpc('get_kocs_with_video_count', { p_user_id: userId });

  if (error) throw new Error(error.message);
  return data as Koc[];
};

const ListKoc = () => {
  const { user } = useSession();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedKoc, setSelectedKoc] = useState<Koc | null>(null);

  const { data: kocs, isLoading, isError, error } = useQuery<Koc[]>({
    queryKey: ["kocs", user?.id],
    queryFn: () => fetchKocs(user!.id),
    enabled: !!user,
  });

  const handleEdit = (koc: Koc) => {
    setSelectedKoc(koc);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (koc: Koc) => {
    setSelectedKoc(koc);
    setIsDeleteDialogOpen(true);
  };

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Danh sách KOC</h1>
            <p className="text-muted-foreground mt-1">Quản lý tất cả KOC ảo của bạn ở một nơi.</p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-red-600 hover:bg-red-700 text-white w-full md:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Tạo KOC mới
          </Button>
        </header>

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex-row gap-4 items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-8" />
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <Skeleton className="h-12 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Lỗi</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}

        {!isLoading && !isError && kocs && kocs.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {kocs.map((koc) => (
              <KocCard
                key={koc.id}
                koc={koc}
                onEdit={() => handleEdit(koc)}
                onDelete={() => handleDelete(koc)}
              />
            ))}
          </div>
        )}

        {!isLoading && !isError && kocs && kocs.length === 0 && (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <h3 className="text-xl font-semibold">Chưa có KOC nào</h3>
            <p className="text-muted-foreground mt-2 mb-4">Hãy tạo KOC đầu tiên của bạn để bắt đầu.</p>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-red-600 hover:bg-red-700 text-white">
              <Plus className="mr-2 h-4 w-4" /> Tạo KOC mới
            </Button>
          </div>
        )}
      </div>

      <CreateKocDialog isOpen={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
      <EditKocDialog isOpen={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} koc={selectedKoc} />
      <DeleteKocDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        koc={selectedKoc}
      />
    </>
  );
};

export default ListKoc;