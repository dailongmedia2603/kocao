import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

// UI Components
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EditKocDialog } from "@/components/koc/EditKocDialog";

// Icons
import {
  Edit,
  ThumbsUp,
  Eye,
  ShoppingCart,
  TrendingUp,
  Megaphone,
  SlidersHorizontal,
  CreditCard,
  FileText,
  ArrowLeft,
} from "lucide-react";

// Types
type Koc = {
  id: string;
  name: string;
  field: string | null;
  avatar_url: string | null;
  created_at: string;
};

// Data fetching
const fetchKocDetails = async (kocId: string) => {
  const { data, error } = await supabase
    .from("kocs")
    .select("id, name, field, avatar_url, created_at")
    .eq("id", kocId)
    .single();
  if (error) throw error;
  return data;
};

// Mock data from the image
const performanceMetrics = [
  { title: "Tỷ lệ tương tác", value: "4.5%", icon: ThumbsUp },
  { title: "Lượt tiếp cận", value: "15K", icon: Eye },
  { title: "Lượt chuyển đổi", value: "500", icon: ShoppingCart },
  { title: "ROI", value: "120%", icon: TrendingUp },
];

const assignedCampaigns = [
  {
    name: "Summer Style Showcase",
    status: "Active",
    startDate: "2024-07-01",
    endDate: "2024-07-31",
    budget: "$5,000",
  },
  {
    name: "Autumn Beauty Launch",
    status: "Completed",
    startDate: "2024-06-15",
    endDate: "2024-06-30",
    budget: "$3,200",
  },
  {
    name: "Winter Wellness",
    status: "Planned",
    startDate: "2024-08-01",
    endDate: "2024-08-15",
    budget: "$4,500",
  },
];

const communicationHistory = [
  { title: "Gửi brief chiến dịch", date: "2024-07-15", icon: Megaphone },
  { title: "Yêu cầu duyệt nội dung", date: "2024-07-18", icon: SlidersHorizontal },
  { title: "Xác nhận thanh toán", date: "2024-07-20", icon: CreditCard },
  { title: "Báo cáo hiệu suất", date: "2024-07-25", icon: FileText },
];

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
};

const KocDetail = () => {
  const { kocId } = useParams<{ kocId: string }>();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { data: koc, isLoading: isKocLoading } = useQuery<Koc>({
    queryKey: ["koc", kocId],
    queryFn: () => fetchKocDetails(kocId!),
    enabled: !!kocId,
  });

  if (isKocLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-8">
          <div className="col-span-2 space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="col-span-1">
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!koc) {
    return (
      <div className="p-8">
        <Link
          to="/list-koc"
          className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại danh sách KOC
        </Link>
        <h1 className="text-2xl font-bold">KOC không tồn tại</h1>
        <p>Không thể tìm thấy KOC bạn đang tìm kiếm.</p>
      </div>
    );
  }

  return (
    <>
      <div className="p-6 lg:p-8">
        <Link
          to="/list-koc"
          className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại danh sách KOC
        </Link>
        <header className="mb-6">
          <h1 className="text-3xl font-bold">Chi tiết KOC ảo</h1>
          <p className="text-muted-foreground mt-1">
            Quản lý và theo dõi hiệu suất và hoạt động của KOC ảo của bạn.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Profile Card */}
            <Card className="overflow-hidden">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <Avatar className="h-24 w-24 border-4 border-white shadow-md">
                    <AvatarImage
                      src={koc.avatar_url || undefined}
                      alt={koc.name}
                    />
                    <AvatarFallback className="text-3xl">
                      {getInitials(koc.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-2xl font-bold">{koc.name}</h2>
                    <p className="text-muted-foreground">
                      {koc.field || "Virtual KOC"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Tham gia{" "}
                      {formatDistanceToNow(new Date(koc.created_at), {
                        addSuffix: true,
                        locale: vi,
                      })}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setIsEditDialogOpen(true)}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <Edit className="mr-2 h-4 w-4" /> Chỉnh sửa
                </Button>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList>
                <TabsTrigger value="overview">Tổng quan</TabsTrigger>
                <TabsTrigger value="campaigns" disabled>
                  Chiến dịch
                </TabsTrigger>
                <TabsTrigger value="content">
                  <Link to={`/list-koc/${koc.id}/content`}>Nội dung</Link>
                </TabsTrigger>
                <TabsTrigger value="communication" disabled>
                  Lịch sử
                </TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="mt-6">
                <div className="space-y-8">
                  {/* Performance Metrics */}
                  <div>
                    <h3 className="text-xl font-semibold mb-4">
                      Chỉ số hiệu suất
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {performanceMetrics.map((metric) => (
                        <Card key={metric.title}>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <metric.icon className="h-4 w-4" />
                              <span>{metric.title}</span>
                            </div>
                            <p className="text-3xl font-bold mt-2">
                              {metric.value}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* Assigned Campaigns */}
                  <div>
                    <h3 className="text-xl font-semibold mb-4">
                      Chiến dịch đã tham gia
                    </h3>
                    <Card>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tên chiến dịch</TableHead>
                            <TableHead>Trạng thái</TableHead>
                            <TableHead>Ngày bắt đầu</TableHead>
                            <TableHead>Ngày kết thúc</TableHead>
                            <TableHead>Ngân sách</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {assignedCampaigns.map((campaign) => (
                            <TableRow key={campaign.name}>
                              <TableCell className="font-medium">
                                {campaign.name}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    campaign.status === "Active"
                                      ? "default"
                                      : "outline"
                                  }
                                  className={
                                    campaign.status === "Active"
                                      ? "bg-green-100 text-green-800"
                                      : campaign.status === "Completed"
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-gray-100 text-gray-800"
                                  }
                                >
                                  {campaign.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{campaign.startDate}</TableCell>
                              <TableCell>{campaign.endDate}</TableCell>
                              <TableCell>{campaign.budget}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Card>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Lịch sử trao đổi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {communicationHistory.map((item) => (
                    <div key={item.title} className="flex items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold">{item.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.date}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <EditKocDialog
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        koc={koc}
      />
    </>
  );
};

export default KocDetail;