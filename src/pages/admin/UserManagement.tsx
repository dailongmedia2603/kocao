import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

// UI Components
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AddUserDialog } from "./AddUserDialog";
import { AssignPlanDialog } from "./AssignPlanDialog";

// Icons
import { Plus, MoreHorizontal, Trash2, Loader2, User, Shield, CheckCircle, Clock, Ban, Layers } from "lucide-react";

// Utils
import { showSuccess, showError } from "@/utils/toast";

// Type
type UserProfile = {
  id: string;
  email: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  role: 'admin' | 'user';
  status: 'active' | 'pending' | 'banned';
  subscription_plan_name: string | null;
  subscription_plan_id: string | null;
};

const UserManagement = () => {
  const [isAddUserOpen, setAddUserOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [userToAssignPlan, setUserToAssignPlan] = useState<UserProfile | null>(null);
  const queryClient = useQueryClient();
  const { user: currentUser } = useSession();

  const { data: users = [], isLoading } = useQuery<UserProfile[]>({
    queryKey: ["all_users"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-all-users");
      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      return data;
    },
  });

  const updateUserRoleMutation = useMutation({
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
    onError: (error: Error) => showError(error.message),
  });

  const updateUserStatusMutation = useMutation({
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
    onError: (error: Error) => showError(error.message),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { userIdToDelete: userId },
      });
      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
    },
    onSuccess: () => {
      showSuccess("Xóa người dùng thành công!");
      queryClient.invalidateQueries({ queryKey: ["all_users"] });
      setUserToDelete(null);
    },
    onError: (error: Error) => showError(error.message),
  });

  const getRoleBadge = (role: 'admin' | 'user') => {
    if (role === 'admin') {
      return <Badge variant="destructive"><Shield className="mr-1 h-3 w-3" /> Admin</Badge>;
    }
    return <Badge variant="secondary"><User className="mr-1 h-3 w-3" /> User</Badge>;
  };

  const getStatusBadge = (status: 'active' | 'pending' | 'banned') => {
    if (status === 'active') {
      return <Badge className="bg-green-100 text-green-800"><CheckCircle className="mr-1 h-3 w-3" /> Hoạt động</Badge>;
    }
    if (status === 'pending') {
      return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="mr-1 h-3 w-3" /> Chờ duyệt</Badge>;
    }
    if (status === 'banned') {
        return <Badge variant="destructive"><Ban className="mr-1 h-3 w-3" /> Cấm</Badge>;
    }
    return <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Quản lý Người dùng</h1>
            <p className="text-muted-foreground mt-1">Xem, chỉnh sửa và quản lý tất cả người dùng trong hệ thống.</p>
          </div>
          <Button onClick={() => setAddUserOpen(true)} className="bg-red-600 hover:bg-red-700 text-white">
            <Plus className="mr-2 h-4 w-4" /> Thêm người dùng
          </Button>
        </header>

        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Họ và Tên</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Gói cước</TableHead>
                <TableHead>Ngày tham gia</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{`${user.last_name || ''} ${user.first_name || ''}`.trim() || 'Chưa có tên'}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>{getStatusBadge(user.status)}</TableCell>
                    <TableCell>
                      {user.subscription_plan_name ? (
                        <Badge variant="outline">{user.subscription_plan_name}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Chưa có</span>
                      )}
                    </TableCell>
                    <TableCell>{format(new Date(user.created_at), 'dd/MM/yyyy', { locale: vi })}</TableCell>
                    <TableCell className="text-right">
                      {user.id !== currentUser?.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Mở menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setUserToAssignPlan(user)}>
                              <Layers className="mr-2 h-4 w-4" /> Gán gói cước
                            </DropdownMenuItem>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>Đổi vai trò</DropdownMenuSubTrigger>
                              <DropdownMenuPortal>
                                <DropdownMenuSubContent>
                                  <DropdownMenuItem onClick={() => updateUserRoleMutation.mutate({ userId: user.id, newRole: 'admin' })}>Admin</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateUserRoleMutation.mutate({ userId: user.id, newRole: 'user' })}>User</DropdownMenuItem>
                                </DropdownMenuSubContent>
                              </DropdownMenuPortal>
                            </DropdownMenuSub>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>Đổi trạng thái</DropdownMenuSubTrigger>
                              <DropdownMenuPortal>
                                <DropdownMenuSubContent>
                                  <DropdownMenuItem onClick={() => updateUserStatusMutation.mutate({ userId: user.id, newStatus: 'active' })}>Hoạt động</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateUserStatusMutation.mutate({ userId: user.id, newStatus: 'pending' })}>Chờ duyệt</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateUserStatusMutation.mutate({ userId: user.id, newStatus: 'banned' })}>Cấm</DropdownMenuItem>
                                </DropdownMenuSubContent>
                              </DropdownMenuPortal>
                            </DropdownMenuSub>
                            <DropdownMenuItem className="text-destructive" onClick={() => setUserToDelete(user)}>
                              Xóa người dùng
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    Không có người dùng nào.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AddUserDialog isOpen={isAddUserOpen} onOpenChange={setAddUserOpen} />

      <AssignPlanDialog
        isOpen={!!userToAssignPlan}
        onOpenChange={() => setUserToAssignPlan(null)}
        user={userToAssignPlan}
      />

      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Người dùng "{userToDelete?.first_name} {userToDelete?.last_name}" sẽ bị xóa vĩnh viễn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete.id)}
              disabled={deleteUserMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default UserManagement;