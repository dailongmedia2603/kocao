import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { showSuccess, showError } from "@/utils/toast";

// UI Components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// Icons
import { MoreHorizontal, Trash2, Loader2, AlertCircle, Users } from "lucide-react";
import { useSession } from "@/contexts/SessionContext";

type UserProfile = {
  id: string;
  email: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  role: 'admin' | 'user';
  status: 'active' | 'pending' | 'banned';
};

const getInitials = (firstName?: string | null, lastName?: string | null) => {
  const first = firstName?.[0] || "";
  const last = lastName?.[0] || "";
  return `${first}${last}`.toUpperCase() || "??";
};

const UserManagement = () => {
  const queryClient = useQueryClient();
  const { user: adminUser } = useSession();
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  const { data: users = [], isLoading, error } = useQuery<UserProfile[]>({
    queryKey: ['all_users'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-all-users');
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string, newRole: string }) => {
      const { error } = await supabase.rpc('update_user_role', { user_id_to_update: userId, new_role: newRole });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Cập nhật vai trò thành công!");
      queryClient.invalidateQueries({ queryKey: ['all_users'] });
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, newStatus }: { userId: string, newStatus: string }) => {
      const { error } = await supabase.rpc('update_user_status', { user_id_to_update: userId, new_status: newStatus });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Cập nhật trạng thái thành công!");
      queryClient.invalidateQueries({ queryKey: ['all_users'] });
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.functions.invoke('delete-user', { body: { userIdToDelete: userId } });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      showSuccess("Xóa người dùng thành công!");
      queryClient.invalidateQueries({ queryKey: ['all_users'] });
      setUserToDelete(null);
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'pending': return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'banned': return <Badge variant="destructive">Banned</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold">Quản lý Người dùng</h1>
          <p className="text-muted-foreground mt-1">Xem, chỉnh sửa và quản lý tất cả người dùng trong hệ thống.</p>
        </header>
        <Card>
          <CardHeader>
            <CardTitle>Danh sách người dùng</CardTitle>
            <CardDescription>Tổng số {users.length} người dùng.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Người dùng</TableHead>
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
                      <TableCell><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-full" /><div className="space-y-1"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-32" /></div></div></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : error ? (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center text-destructive"><AlertCircle className="mx-auto h-6 w-6" /><p className="mt-2">Lỗi tải dữ liệu: {error.message}</p></TableCell></TableRow>
                ) : users.length > 0 ? (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar><AvatarFallback>{getInitials(user.first_name, user.last_name)}</AvatarFallback></Avatar>
                          <div>
                            <p className="font-medium">{user.first_name} {user.last_name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.role}
                          onValueChange={(newRole) => updateRoleMutation.mutate({ userId: user.id, newRole })}
                          disabled={updateRoleMutation.isPending || user.id === adminUser?.id}
                        >
                          <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.status}
                          onValueChange={(newStatus) => updateStatusMutation.mutate({ userId: user.id, newStatus })}
                          disabled={updateStatusMutation.isPending || user.id === adminUser?.id}
                        >
                          <SelectTrigger className="w-[110px]"><StatusBadge status={user.status} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="banned">Banned</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{format(new Date(user.created_at), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" disabled={user.id === adminUser?.id}><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setUserToDelete(user)} className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" /> Xóa người dùng
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center"><Users className="mx-auto h-6 w-6" /><p className="mt-2">Không có người dùng nào.</p></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
            <AlertDialogDescription>Hành động này không thể hoàn tác. Người dùng "{userToDelete?.email}" sẽ bị xóa vĩnh viễn.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete.id)} disabled={deleteUserMutation.isPending} className="bg-destructive hover:bg-destructive/90">
              {deleteUserMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default UserManagement;