import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useState } from "react";

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

// Icons
import { MoreHorizontal, UserCheck, UserX, Shield, ShieldOff, Loader2 } from "lucide-react";

// Utils
import { showSuccess, showError } from "@/utils/toast";

// Types
type UserProfile = {
  id: string;
  email: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  status: string;
};

// Helper components
const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-100 text-green-800 border-green-200">Đã duyệt</Badge>;
    case 'pending':
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Chờ duyệt</Badge>;
    case 'inactive':
      return <Badge variant="destructive">Vô hiệu hóa</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const RoleBadge = ({ role }: { role: string }) => {
  switch (role) {
    case 'admin':
      return <Badge variant="default" className="bg-primary text-primary-foreground">Admin</Badge>;
    case 'user':
    default:
      return <Badge variant="outline">User</Badge>;
  }
};

// Main Component
const UserManagement = () => {
  const queryClient = useQueryClient();
  const [actionConfirmation, setActionConfirmation] = useState<{ action: () => void; title: string; description: string; } | null>(null);

  const queryKey = ['all_users'];

  const { data: users = [], isLoading } = useQuery<UserProfile[]>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_all_users_with_profiles');
      if (error) throw error;
      return data;
    },
  });

  const updateUserStatusMutation = useMutation({
    mutationFn: async ({ userId, newStatus }: { userId: string; newStatus: string }) => {
      const { error } = await supabase.rpc('update_user_status', { user_id_to_update: userId, new_status: newStatus });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Cập nhật trạng thái người dùng thành công!");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
    onSettled: () => setActionConfirmation(null),
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      const { error } = await supabase.rpc('update_user_role', { user_id_to_update: userId, new_role: newRole });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Cập nhật vai trò người dùng thành công!");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
    onSettled: () => setActionConfirmation(null),
  });

  const handleAction = (action: () => void, title: string, description: string) => {
    setActionConfirmation({ action, title, description });
  };

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold">Quản lý Người dùng</h1>
          <p className="text-muted-foreground mt-1">Duyệt, quản lý vai trò và theo dõi tất cả người dùng.</p>
        </header>
        <Card>
          <CardHeader>
            <CardTitle>Tất cả Người dùng</CardTitle>
            <CardDescription>Danh sách tất cả các tài khoản đã đăng ký trong hệ thống.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Người dùng</TableHead>
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
                      <TableCell className="font-medium">{user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Chưa cập nhật'}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell><RoleBadge role={user.role} /></TableCell>
                      <TableCell><StatusBadge status={user.status} /></TableCell>
                      <TableCell>{format(new Date(user.created_at), 'dd/MM/yyyy', { locale: vi })}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {user.status === 'pending' && (
                              <DropdownMenuItem onClick={() => handleAction(() => updateUserStatusMutation.mutate({ userId: user.id, newStatus: 'active' }), 'Duyệt người dùng?', `Bạn có chắc muốn duyệt tài khoản ${user.email}?`)}>
                                <UserCheck className="mr-2 h-4 w-4" /> Duyệt
                              </DropdownMenuItem>
                            )}
                            {user.status === 'active' && (
                              <DropdownMenuItem className="text-destructive" onClick={() => handleAction(() => updateUserStatusMutation.mutate({ userId: user.id, newStatus: 'inactive' }), 'Vô hiệu hóa người dùng?', `Bạn có chắc muốn vô hiệu hóa tài khoản ${user.email}?`)}>
                                <UserX className="mr-2 h-4 w-4" /> Vô hiệu hóa
                              </DropdownMenuItem>
                            )}
                            {user.status === 'inactive' && (
                              <DropdownMenuItem onClick={() => handleAction(() => updateUserStatusMutation.mutate({ userId: user.id, newStatus: 'active' }), 'Kích hoạt lại người dùng?', `Bạn có chắc muốn kích hoạt lại tài khoản ${user.email}?`)}>
                                <UserCheck className="mr-2 h-4 w-4" /> Kích hoạt lại
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {user.role === 'user' && (
                              <DropdownMenuItem onClick={() => handleAction(() => updateUserRoleMutation.mutate({ userId: user.id, newRole: 'admin' }), 'Nâng cấp lên Admin?', `Bạn có chắc muốn cấp quyền quản trị viên cho ${user.email}?`)}>
                                <Shield className="mr-2 h-4 w-4" /> Cấp quyền Admin
                              </DropdownMenuItem>
                            )}
                            {user.role === 'admin' && (
                              <DropdownMenuItem className="text-destructive" onClick={() => handleAction(() => updateUserRoleMutation.mutate({ userId: user.id, newRole: 'user' }), 'Hạ cấp xuống User?', `Bạn có chắc muốn gỡ quyền quản trị viên của ${user.email}?`)}>
                                <ShieldOff className="mr-2 h-4 w-4" /> Gỡ quyền Admin
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center">Không tìm thấy người dùng nào.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!actionConfirmation} onOpenChange={() => setActionConfirmation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{actionConfirmation?.title}</AlertDialogTitle>
            <AlertDialogDescription>{actionConfirmation?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={actionConfirmation?.action} disabled={updateUserStatusMutation.isPending || updateUserRoleMutation.isPending}>
              {(updateUserStatusMutation.isPending || updateUserRoleMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default UserManagement;