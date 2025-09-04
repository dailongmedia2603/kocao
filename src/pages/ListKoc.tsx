import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { Link } from "react-router-dom";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertCircle, Plus, UserSquare2, Tag, Copy } from "lucide-react";
import { CreateKocDialog } from "@/components/koc/CreateKocDialog";
import { showSuccess } from "@/utils/toast";

type Koc = {
  id: string;
  name: string;
  field: string | null;
  avatar_url: string | null;
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

const KocCard = ({ koc }: { koc: Koc }) => {
  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    showSuccess("Đã sao chép ID của KOC!");
  };

  return (
    <Card className="hover:shadow-lg transition-shadow relative group text-center">
      <Link to={`/list-koc/${koc.id}`} className="after:absolute after:inset-0">
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-3">
            <Avatar className="h-20 w-20">
              <AvatarImage src={koc.avatar_url || undefined} alt={koc.name} />
              <AvatarFallback className="text-3xl bg-red-100 text-red-600">
                {koc.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{koc.name}</CardTitle>
              {koc.field && (
                <CardDescription className="flex items-center justify-center gap-1.5 mt-1">
                  <Tag className="h-3 w-3" />
                  {koc.field}
                </CardDescription>
              )}
            </div>
          </div>
        </CardContent>
      </Link>
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleCopyId(koc.id);
        }}
      >
        <Copy className="h-4 w-4 mr-2" /> Sao chép ID
      </Button>
    </Card>
  );
};

const ListKoc = () => {
  const { user } = useSession();
  const [isCreateOpen, setCreateOpen] = useState(false);

  const { data: kocs, isLoading, isError, error } = useQuery<Koc[]>({
    queryKey: ["kocs", user?.id],
    queryFn: () => fetchKocs(user!.id),
    enabled: !!user,
  });

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Quản lý KOC</h1>
            <p className="text-muted-foreground mt-1">Tạo và quản lý danh sách KOC của bạn.</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="bg-red-600 hover:bg-red-700 text-white">
            <Plus className="mr-2 h-4 w-4" /> Thêm KOC
          </Button>
        </header>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
          </div>
        ) : isError ? (
          <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Lỗi</AlertTitle><AlertDescription>{error.message}</AlertDescription></Alert>
        ) : kocs && kocs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {kocs.map((koc) => <KocCard key={koc.id} koc={koc} />)}
          </div>
        ) : (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <UserSquare2 className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-xl font-semibold text-gray-700">Chưa có KOC nào</h3>
            <p className="text-gray-500 mt-2 mb-4">Bắt đầu bằng cách thêm KOC đầu tiên của bạn.</p>
            <Button onClick={() => setCreateOpen(true)} className="bg-red-600 hover:bg-red-700 text-white">
              <Plus className="h-4 w-4 mr-2" /> Thêm KOC
            </Button>
          </div>
        )}
      </div>
      <CreateKocDialog isOpen={isCreateOpen} onOpenChange={setCreateOpen} />
    </>
  );
};

export default ListKoc;