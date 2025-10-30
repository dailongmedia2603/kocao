import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

// UI Components
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { Skeleton } from "@/components/ui/skeleton";

// Icons
import { Plus, MoreHorizontal, Edit, Trash2, Users, User as UserIcon, ShieldCheck, CheckCircle2, Hourglass, XCircle } from "lucide-react";

// Custom Components
import { AddUserDialog } from "./AddUserDialog";
import { EditUserDialog } from "./EditUserDialog";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";

// Type Definitions
type User = {
  id: string;
  email: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  role: 'admin' | 'user';
  status: 'active' | 'pending' | 'banned';
};

// Badge Components
const RoleBadge = ({ role }: { role: 'admin' | 'user' }) => {
  const isAdmin = role === 'admin';
  return (
    <Badge
      variant="outline"
      className={cn(
        "flex items-center gap-1.5 w-fit",
        isAdmin
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-gray-200 bg-gray-50 text-gray-700"
      )}
    >
      {isAdmin ? <ShieldCheck className="h-3.5 w-3.5" /> : <UserIcon className="h-3.5 w-3.5" />}
      <span className="font-medium">{isAdmin ? 'Admin' : 'User'}</span>
    </Badge>
  );
};

const StatusBadge = ({ status }: { status: 'active' | 'pending' | 'banned' }) => {
  if (status === 'active') {
    return (
      <Badge variant="outline" className="flex items-center gap-1.5 w-fit border-green-200 bg-green-50 text-green-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span className="font-medium">Hoạt động</span>
      </Badge>
    );
  }
  if (status === 'pending') {
    return (
      <Badge variant="outline" className="flex items-center gap-1.5 w-fit border-yellow-200 bg-yellow-50 text-yellow-700">
        <Hourglass className="h-3.5 w-3.5" />
        <span className="font-medium">Chờ duyệt</span>
      </Badge>
    );
  }
  if (status === 'banned') {
    return (
      <Badge variant="outline" className="flex items-center gap-1.5 w-fit border-red-200 bg-red-50 text-red-700">
        <XCircle className="h-3.5 w-3.5" />
        <span className="font-medium">Cấm</span>
      </Badge>
    );
  }
  return <Badge variant="secondary">{status}</Badge>;
};

// Main Component
const UserManagement = () => {
  const { user: adminUser } = useSession();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["all_users"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-all-users");
      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      return data;
    },
    enabled: !!adminUser,
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string, newRole: 'admin' | 'user' }) => {
      const { error } = await supabase.rpc('update_user_role', {
        user_id_to_update: userId,
        new_role: newRole,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Cập nhật vai trò thành công!");
      queryClient.invalidateQueries({ queryKey: ["all_users"] });
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, newStatus }: { userId: string, newStatus: 'active' | 'pending' | 'banned' }) => {
      const { error } = await supabase.rpc('update_user_status', {
        user_id_to_update: userId,
        new_status: newStatus,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Cập nhật trạng thái thành công!");
      queryClient.invalidateQueries({ queryKey: ["all_users"] });
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.functions.invoke("delete-user", { body: { userIdToDelete: userId } });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      showSuccess(`Đã xóa người dùng thành công!`);
      queryClient.invalidateQueries({ queryKey: ["all_users"] });
      setUserToDelete(null);
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
      setUserToDelete(null);
    },
  });

  const handleEdit = (user: User) => {
    setUserToEdit(user);
    setEditDialogOpen(true);
  };

  const handleDelete = (user: User) => {
    setUserToDelete(user);
  };

  const confirmDelete = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  };

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Quản lý Người dùng</h1>
            <p className="text-muted-foreground mt-1">Xem, chỉnh sửa và quản lý tất cả người dùng trong hệ thống.</p>
          </div>
          <Button onClick={() => setAddDialogOpen(true)} className="bg-red-600 hover:bg-red-700 text-white w-full md:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Thêm người dùng
          </Button>
        </header>

        <div className="rounded-lg bg-card text-card-foreground shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Họ và Tên</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ngày tham gia</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.last_name} {user.first_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell><RoleBadge role={user.role} /></TableCell>
                    <TableCell><StatusBadge status={user.status} /></TableCell>
                    <TableCell>{format(new Date(user.created_at), "dd/MM/yyyy", { locale: vi })}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0" disabled={user.id === adminUser?.id}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Hành động</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleEdit(user)}>
                            <Edit className="mr-2 h-4 w-4" /> Sửa
                          </DropdownMenuItem>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>Đổi vai trò</DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                              <DropdownMenuSubContent>
                                <DropdownMenuItem onClick={() => updateRoleMutation.mutate({ userId: user.id, newRole: 'admin' })}>Admin</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateRoleMutation.mutate({ userId: user.id, newRole: 'user' })}>User</DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                          </DropdownMenuSub>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>Đổi trạng thái</DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                              <DropdownMenuSubContent>
                                <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ userId: user.id, newStatus: 'active' })}>Hoạt động</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ userId: user.id, newStatus: 'pending' })}>Chờ duyệt</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ userId: user.id, newStatus: 'banned' })}>Cấm</DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                          </DropdownMenuSub>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(user)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Xóa người dùng
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-4 font-medium">Không có người dùng nào</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AddUserDialog isOpen={isAddDialogOpen} onOpenChange={setAddDialogOpen} />
      <EditUserDialog isOpen={isEditDialogOpen} onOpenChange={setEditDialogOpen} user={userToEdit} />
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này sẽ xóa vĩnh viễn người dùng "{userToDelete?.first_name} {userToDelete?.last_name}". Không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteUserMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteUserMutation.isPending ? "Đang xóa..." : `Xóa`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default UserManagement;