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
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Edit, Mic, PlayCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const mockNews = [
  {
    id: 1,
    fanpage: { name: "Kênh 14", avatar: "https://i.pravatar.cc/150?img=1" },
    content: "Sơn Tùng M-TP bất ngờ tung teaser cho sản phẩm âm nhạc mới, hứa hẹn một mùa hè bùng nổ...",
    postDate: "2024-09-08T10:00:00Z",
    status: "new",
    voiceScript: null,
  },
  {
    id: 2,
    fanpage: { name: "VNExpress", avatar: "https://i.pravatar.cc/150?img=2" },
    content: "Giá vàng trong nước và thế giới đồng loạt tăng mạnh sau phiên điều chỉnh của FED.",
    postDate: "2024-09-08T09:30:00Z",
    status: "voice_generated",
    voiceScript: "Giá vàng hôm nay đã có những biến động mạnh...",
  },
  {
    id: 3,
    fanpage: { name: "BeatVN", avatar: "https://i.pravatar.cc/150?img=3" },
    content: "Cộng đồng mạng xôn xao trước hình ảnh check-in tại địa điểm du lịch mới nổi ở Hà Giang.",
    postDate: "2024-09-07T15:00:00Z",
    status: "new",
    voiceScript: null,
  },
];

const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case "new":
      return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">Mới</Badge>;
    case "voice_generated":
      return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">Đã tạo voice</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

export const NewsTable = () => {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">STT</TableHead>
            <TableHead>Fanpage</TableHead>
            <TableHead>Nội dung post</TableHead>
            <TableHead>Ngày post</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Kịch bản voice</TableHead>
            <TableHead className="text-right">Hành động</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mockNews.map((item, index) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{index + 1}</TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={item.fanpage.avatar} alt={item.fanpage.name} />
                    <AvatarFallback>{item.fanpage.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{item.fanpage.name}</span>
                </div>
              </TableCell>
              <TableCell>
                <p className="max-w-xs truncate" title={item.content}>
                  {item.content}
                </p>
              </TableCell>
              <TableCell>{new Date(item.postDate).toLocaleDateString('vi-VN')}</TableCell>
              <TableCell>
                <StatusBadge status={item.status} />
              </TableCell>
              <TableCell>
                {item.voiceScript ? (
                  <Button variant="outline" size="sm">
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Xem kịch bản
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm">
                    <Mic className="mr-2 h-4 w-4" />
                    Tạo voice
                  </Button>
                )}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Mở menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Edit className="mr-2 h-4 w-4" />
                      <span>Sửa</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600">
                      <Trash2 className="mr-2 h-4 w-4" />
                      <span>Xóa</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};