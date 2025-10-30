import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/contexts/SessionContext";

// Shadcn UI components
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MoreHorizontal, Trash2, UserCog, ShieldCheck, CheckCircle, XCircle, Hourglass, Loader2 } from "lucide-react";

// Type definition for a user
type UserProfile = {
  id: string;
  email: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  role: 'admin' | 'user';
  status: 'active' | 'pending' | 'banned';
};

// Component for status badge
const StatusBadge = ({ status }: { status: UserProfile['status'] }) => {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle className="mr-1 h-3 w-3" />Hoạt động</Badge>;
    case 'pending':
      return <Badge variant="outline" className="text-yellow-800 border-yellow-200"><Hourglass className="mr-1 h-3 w-3" />Chờ duyệt</Badge>;
    case 'banned':
      return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Bị cấm</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

// Component for role badge
const RoleBadge = ({ role }: { role: UserProfile['role'] }) => {
  switch (role) {
    case 'admin':
      return <Badge variant="outline" className="text-red-800 border-red-200"><ShieldCheck className="mr-1 h-3 w-3" />Admin</Badge>;
    case 'user':
      return <Badge variant="secondary"><UserCog className="mr-1 h-3 w-3" />User</Badge>;
    default:
      return <Badge variant="secondary">{role}</Badge>;
  }
};

const UserManagement = () => {
  const queryClient = useQueryClient();
  const { user: adminUser } = useSession();
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  // Fetch all users
  const { data: users, isLoading } = useQuery<UserProfile[]>({
    queryKey: ['all_users'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-all-users');
      if (error) throw new Error(error.message);
      return data;
    },
  });

  // Mutation to update user role
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: UserProfile['role'] }) => {
      const { error } = await supabase.rpc('update_user_role', {
        user_id_to_update: userId,
        new_role: newRole,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Cập nhật vai trò thành công!");
      queryClient.invalidateQueries({ queryKey: ['all_users'] });
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  // Mutation to update user status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, newStatus }: { userId: string; newStatus: UserProfile['status'] }) => {
      const { error } = await supabase.rpc('update_user_status', {
        user_id_to_update: userId,
        new_status: newStatus,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Cập nhật trạng thái thành công!");
      queryClient.invalidateQueries({ queryKey: ['all_users'] });
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  // Mutation to delete a user
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.functions.invoke('delete-user', {
        body: { userIdToDelete: userId },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      showSuccess("Xóa người dùng thành công!");
      queryClient.invalidateQueries({ queryKey: ['all_users'] });
      setUserToDelete(null);
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
      setUserToDelete(null);
    },
  });

  const handleDelete = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  };

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">Quản lý Người dùng</h1>
          <p className="text-muted-foreground mt-1">Xem, chỉnh sửa và quản lý tất cả người dùng trong hệ thống.</p>
        </header>

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
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
              ) : users && users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.first_name || ''} {user.last_name || ''}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell><RoleBadge role={user.role} /></TableCell>
                    <TableCell><StatusBadge status={user.status} /></TableCell>
                    <TableCell>{format(new Date(user.created_at), 'dd/MM/yyyy', { locale: vi })}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0" disabled={user.id === adminUser?.id}>
                            <span className="sr-only">Mở menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Hành động</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>Đổi vai trò</DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                              <DropdownMenuSubContent>
                                <DropdownMenuItem onClick={() => updateRoleMutation.mutate({ userId: user.id, newRole: 'admin' })}>
                                  Admin
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateRoleMutation.mutate({ userId: user.id, newRole: 'user' })}>
                                  User
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                          </DropdownMenuSub>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>Đổi trạng thái</DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                              <DropdownMenuSubContent>
                                <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ userId: user.id, newStatus: 'active' })}>
                                  Hoạt động
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ userId: user.id, newStatus: 'pending' })}>
                                  Chờ duyệt
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ userId: user.id, newStatus: 'banned' })}>
                                  Cấm
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                          </DropdownMenuSub>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600" onClick={() => setUserToDelete(user)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Xóa người dùng
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    Không có người dùng nào.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={!!userToDelete} onOpenChange={(isOpen) => !isOpen && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Người dùng <span className="font-bold">{userToDelete?.email}</span> sẽ bị xóa vĩnh viễn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteUserMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteUserMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang xóa...</> : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default UserManagement;