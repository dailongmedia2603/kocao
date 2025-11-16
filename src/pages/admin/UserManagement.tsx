import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

// UI Components
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AddUserDialog } from "./AddUserDialog";
import { AssignPlanDialog } from "./AssignPlanDialog";

// Icons
import { Plus, MoreHorizontal, Trash2, Edit, UserCog, ShieldCheck, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";

// Utils
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/contexts/SessionContext";

// Type
type UserProfile = {
  id: string;
  email: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  role: 'admin' | 'user';
  status: 'active' | 'pending';
  subscription_plan_name: string | null;
  subscription_plan_id: string | null;
};

// Main Component
const UserManagement = () => {
  const { user: currentUser } = useSession();
  const [isAddUserOpen, setAddUserOpen] = useState(false);
  const [isAssignPlanOpen, setAssignPlanOpen] = useState(false);
  const [userToManage, setUserToManage] = useState<UserProfile | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery<UserProfile[]>({
    queryKey: ["all_users"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-all-users");
      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      return data;
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('user-management-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        queryClient.invalidateQueries({ queryKey: ['all_users'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_subscriptions' }, () => {
        queryClient.invalidateQueries({ queryKey: ['all_users'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, field, value }: { userId: string, field: 'role' | 'status', value: string }) => {
      const functionName = field === 'role' ? 'update_user_role' : 'update_user_status';
      const params = field === 'role' ? { user_id_to_update: userId, new_role: value } : { user_id_to_update: userId, new_status: value };
      const { error } = await supabase.rpc(functionName, params);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      showSuccess(`Đã cập nhật ${variables.field === 'role' ? 'vai trò' : 'trạng thái'} người dùng.`);
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

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.[0] || "";
    const last = lastName?.[0] || "";
    return `${last}${first}`.toUpperCase() || "??";
  };

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Quản lý Người dùng</h1>
            <p className="text-muted-foreground mt-1">Xem, tạo và quản lý tài khoản người dùng.</p>
          </div>
          <Button onClick={() => setAddUserOpen(true)} className="bg-red-600 hover:bg-red-700 text-white">
            <Plus className="mr-2 h-4 w-4" /> Thêm người dùng
          </Button>
        </header>

        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Người dùng</TableHead>
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
                    <TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>{getInitials(user.first_name, user.last_name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{`${user.last_name || ''} ${user.first_name || ''}`.trim()}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role === 'admin' ? 'Admin' : 'User'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.status === 'active' ? 'default' : 'outline'} className={user.status === 'active' ? 'bg-green-100 text-green-800' : ''}>
                        {user.status === 'active' ? 'Hoạt động' : 'Chờ duyệt'}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.subscription_plan_name || <span className="text-muted-foreground">Chưa có</span>}</TableCell>
                    <TableCell>{format(new Date(user.created_at), 'dd/MM/yyyy', { locale: vi })}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0" disabled={user.id === currentUser?.id}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setUserToManage(user); setAssignPlanOpen(true); }}>
                            <Edit className="mr-2 h-4 w-4" /> Gán gói cước
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => updateUserMutation.mutate({ userId: user.id, field: 'role', value: user.role === 'admin' ? 'user' : 'admin' })}>
                            {user.role === 'admin' ? <UserCog className="mr-2 h-4 w-4" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                            {user.role === 'admin' ? 'Hạ xuống User' : 'Nâng lên Admin'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateUserMutation.mutate({ userId: user.id, field: 'status', value: user.status === 'active' ? 'pending' : 'active' })}>
                            {user.status === 'active' ? <ToggleLeft className="mr-2 h-4 w-4" /> : <ToggleRight className="mr-2 h-4 w-4" />}
                            {user.status === 'active' ? 'Vô hiệu hóa' : 'Kích hoạt'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setUserToDelete(user)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Xóa người dùng
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6} className="h-24 text-center">Không có người dùng nào.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AddUserDialog isOpen={isAddUserOpen} onOpenChange={setAddUserOpen} />
      <AssignPlanDialog isOpen={isAssignPlanOpen} onOpenChange={setAssignPlanOpen} user={userToManage} />
      
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Tài khoản của "{userToDelete?.first_name} {userToDelete?.last_name}" sẽ bị xóa vĩnh viễn.
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