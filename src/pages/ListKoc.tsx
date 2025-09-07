import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Icons
import { Plus, MoreHorizontal, Edit, Trash2, AlertCircle } from "lucide-react";

// Custom Components
import { CreateKocDialog } from "@/components/koc/CreateKocDialog";
import { EditKocDialog } from "@/components/koc/EditKocDialog";
import { DeleteKocDialog } from "@/components/koc/DeleteKocDialog";

type Koc = {
  id: string;
  name: string;
  field: string | null;
  avatar_url: string | null;
  created_at: string;
  channel_url: string | null;
};

const fetchKocs = async (userId: string) => {
  const { data, error } = await supabase
    .from("kocs")
    .select("id, name, field, avatar_url, created_at, channel_url")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
};

const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase();

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
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Danh sách KOC</h1>
            <p className="text-muted-foreground mt-1">Quản lý tất cả KOC ảo của bạn ở một nơi.</p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-red-600 hover:bg-red-700 text-white">
            <Plus className="mr-2 h-4 w-4" /> Tạo KOC mới
          </Button>
        </header>

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex-row gap-4 items-center">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-3 w-full" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-8 w-24" />
                </CardFooter>
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
              <Card key={koc.id} className="flex flex-col">
                <CardHeader className="flex-row gap-4 items-start">
                  <Link to={`/list-koc/${koc.id}`} className="flex-grow flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={koc.avatar_url || undefined} alt={koc.name} />
                      <AvatarFallback>{getInitials(koc.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <CardTitle className="text-lg hover:text-red-600 transition-colors">{koc.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{koc.field}</p>
                    </div>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(koc)}>
                        <Edit className="mr-2 h-4 w-4" /> Chỉnh sửa
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(koc)} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" /> Xóa
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm text-muted-foreground">
                    Tạo {formatDistanceToNow(new Date(koc.created_at), { addSuffix: true, locale: vi })}
                  </p>
                </CardContent>
                <CardFooter>
                  <Button asChild variant="outline" className="w-full">
                    <Link to={`/list-koc/${koc.id}`}>Xem chi tiết</Link>
                  </Button>
                </CardFooter>
              </Card>
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