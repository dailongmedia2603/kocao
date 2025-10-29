import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

// UI Components
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

// Icons
import { MoreHorizontal, Trash2, UserCheck, UserX, Shield, User, Loader2 } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";

type UserProfile = {
  id: string;
  email: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  role: 'admin' | 'user';
  status: 'active' | 'pending';
};

const getInitials = (firstName?: string | null, lastName?: string | null) => {
  const first = firstName?.[0] || "";
  const last = lastName?.[0] || "";
  return `${first}${last}`.toUpperCase() || "??";
};

const UserManagement = () => {
  const queryClient = useQueryClient();
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  const { data: users, isLoading } = useQuery<UserProfile[]>({
    queryKey: ["all_users"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-all-users");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('public:profiles')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          console.log('User profile change received!', payload);
          queryClient.invalidateQueries({ queryKey: ['all_users'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, field, value }: { userId: string, field: 'role' | 'status', value: string }) => {
      const functionName = field === 'role' ? 'update_user_role' : 'update_user_status';
      const { error } = await supabase.rpc(functionName, {
        user_id_to_update: userId,
        [field === 'role' ? 'new_role' : 'new_status']: value,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Cập nhật người dùng thành công!");
      queryClient.invalidateQueries({ queryKey: ["all_users"] });
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.functions.invoke("delete-user", {
        body: { userIdToDelete: userId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Xóa người dùng thành công!");
      queryClient.invalidateQueries({ queryKey: ["all_users"] });
      setUserToDelete(null);
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
      setUserToDelete(null);
    },
  });

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><UserCheck className="h-3 w-3 mr-1" />Hoạt động</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-yellow-800 border-yellow-200"><UserX className="h-3 w-3 mr-1" />Chờ duyệt</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const RoleBadge = ({ role }: { role: string }) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100"><Shield className="h-3 w-3 mr-1" />Admin</Badge>;
      case 'user':
        return <Badge variant="outline"><User className="h-3 w-3 mr-1" />User</Badge>;
      default:
        return <Badge variant="secondary">{role}</Badge>;
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
                <TableHead>Người dùng</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : users && users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>{getInitials(user.first_name, user.last_name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.first_name} {user.last_name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><RoleBadge role={user.role} /></TableCell>
                    <TableCell><StatusBadge status={user.status} /></TableCell>
                    <TableCell>{format(new Date(user.created_at), 'dd/MM/yyyy', { locale: vi })}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger><span>Cập nhật vai trò</span></DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                              <DropdownMenuSubContent>
                                <DropdownMenuItem onClick={() => updateUserMutation.mutate({ userId: user.id, field: 'role', value: 'admin' })}>
                                  <Shield className="mr-2 h-4 w-4" /> Admin
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateUserMutation.mutate({ userId: user.id, field: 'role', value: 'user' })}>
                                  <User className="mr-2 h-4 w-4" /> User
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                          </DropdownMenuSub>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger><span>Cập nhật trạng thái</span></DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                              <DropdownMenuSubContent>
                                <DropdownMenuItem onClick={() => updateUserMutation.mutate({ userId: user.id, field: 'status', value: 'active' })}>
                                  <UserCheck className="mr-2 h-4 w-4" /> Hoạt động
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateUserMutation.mutate({ userId: user.id, field: 'status', value: 'pending' })}>
                                  <UserX className="mr-2 h-4 w-4" /> Chờ duyệt
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                          </DropdownMenuSub>
                          <DropdownMenuItem className="text-red-600" onClick={() => setUserToDelete(user)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Xóa
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    Không có người dùng nào.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Người dùng "{userToDelete?.email}" sẽ bị xóa vĩnh viễn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete.id)} disabled={deleteUserMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteUserMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default UserManagement;