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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import { Plus, MoreHorizontal, Edit, Trash2, Loader2, Users } from "lucide-react";

// Custom Components
import { AddUserDialog } from "./AddUserDialog";
import { EditUserDialog } from "./EditUserDialog";
import { showSuccess, showError } from "@/utils/toast";

type User = {
  id: string;
  email: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  role: 'admin' | 'user';
  status: 'active' | 'pending';
};

const UserManagement = () => {
  const { user: adminUser } = useSession();
  const queryClient = useQueryClient();
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [usersToDelete, setUsersToDelete] = useState<User[]>([]);

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

  const deleteUsersMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      const deletePromises = userIds.map(id => 
        supabase.functions.invoke("delete-user", { body: { userIdToDelete: id } })
      );
      const results = await Promise.all(deletePromises);
      const errors = results.filter(res => res.error || res.data?.error);
      if (errors.length > 0) {
        throw new Error(errors.map(e => e.error?.message || e.data?.error).join(', '));
      }
    },
    onSuccess: (_, variables) => {
      showSuccess(`Đã xóa ${variables.length} người dùng thành công!`);
      queryClient.invalidateQueries({ queryKey: ["all_users"] });
      setSelectedUserIds([]);
      setUsersToDelete([]);
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
      setUsersToDelete([]);
    },
  });

  const handleSelectUser = (userId: string, checked: boolean) => {
    setSelectedUserIds(prev => 
      checked ? [...prev, userId] : prev.filter(id => id !== userId)
    );
  };

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    if (checked === true) {
      setSelectedUserIds(users.map(user => user.id));
    } else {
      setSelectedUserIds([]);
    }
  };

  const handleEdit = (user: User) => {
    setUserToEdit(user);
    setEditDialogOpen(true);
  };

  const handleDelete = (user: User) => {
    setUsersToDelete([user]);
  };

  const handleBulkDelete = () => {
    const toDelete = users.filter(user => selectedUserIds.includes(user.id));
    setUsersToDelete(toDelete);
  };

  const confirmDelete = () => {
    if (usersToDelete.length > 0) {
      deleteUsersMutation.mutate(usersToDelete.map(u => u.id));
    }
  };

  const numSelected = selectedUserIds.length;
  const rowCount = users.length;

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Quản lý Người dùng</h1>
            <p className="text-muted-foreground mt-1">Thêm, sửa, xóa và quản lý quyền của người dùng.</p>
          </div>
          <Button onClick={() => setAddDialogOpen(true)} className="bg-red-600 hover:bg-red-700 text-white w-full md:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Thêm người dùng
          </Button>
        </header>

        <div className="mb-4 flex h-9 items-center">
          {numSelected > 0 && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Đã chọn {numSelected} trên {rowCount}
              </span>
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Xóa mục đã chọn
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={rowCount > 0 && numSelected === rowCount ? true : (numSelected > 0 ? 'indeterminate' : false)}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                    disabled={isLoading || users.length === 0}
                  />
                </TableHead>
                <TableHead>Họ và tên</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Trạng thái</TableHead>
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
                  <TableRow key={user.id} data-state={selectedUserIds.includes(user.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selectedUserIds.includes(user.id)}
                        onCheckedChange={(checked) => handleSelectUser(user.id, !!checked)}
                        aria-label="Select row"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{user.last_name} {user.first_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{format(new Date(user.created_at), "dd/MM/yyyy", { locale: vi })}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.status === 'active' ? 'default' : 'outline'} className={user.status === 'active' ? 'bg-green-100 text-green-800' : ''}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0" disabled={user.id === adminUser?.id}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(user)}>
                            <Edit className="mr-2 h-4 w-4" /> Sửa
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(user)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Xóa
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center">
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
      <AlertDialog open={usersToDelete.length > 0} onOpenChange={() => setUsersToDelete([])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này sẽ xóa vĩnh viễn {usersToDelete.length} người dùng đã chọn. Không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteUsersMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteUsersMutation.isPending ? "Đang xóa..." : `Xóa (${usersToDelete.length})`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default UserManagement;