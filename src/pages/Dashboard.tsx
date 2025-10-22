"use client";

import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Bot, Video } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

// Define types for the data
interface KOC {
  id: string;
  name: string;
  created_at: string;
  follower_count: number;
  like_count: number;
  video_count: number;
  generated_video_count: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState({
    kocCount: 0,
    campaignCount: 0,
    videoCount: 0,
  });
  const [kocs, setKocs] = useState<KOC[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          // Fetch stats
          const [kocResult, campaignResult, videoResult, kocsResult] =
            await Promise.all([
              supabase
                .from("kocs")
                .select("*", { count: "exact", head: true })
                .eq("user_id", user.id),
              supabase
                .from("automation_campaigns")
                .select("*", { count: "exact", head: true })
                .eq("user_id", user.id),
              supabase
                .from("koc_files")
                .select("*", { count: "exact", head: true })
                .eq("user_id", user.id)
                .like("r2_key", "%/generated/%"),
              supabase.rpc("get_kocs_with_video_count", {
                p_user_id: user.id,
              }),
            ]);

          if (kocResult.error) throw kocResult.error;
          if (campaignResult.error) throw campaignResult.error;
          if (videoResult.error) throw videoResult.error;
          if (kocsResult.error) throw kocsResult.error;

          setStats({
            kocCount: kocResult.count ?? 0,
            campaignCount: campaignResult.count ?? 0,
            videoCount: videoResult.count ?? 0,
          });

          setKocs(kocsResult.data || []);
        }
      } catch (err: any) {
        console.error("Error fetching dashboard data:", err);
        setError("Không thể tải dữ liệu. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-8">
        <div className="grid gap-6 md:grid-cols-3">
          <Card><CardHeader><Skeleton className="h-5 w-24" /></CardHeader><CardContent><Skeleton className="h-8 w-12" /><Skeleton className="h-4 w-32 mt-2" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-5 w-32" /></CardHeader><CardContent><Skeleton className="h-8 w-12" /><Skeleton className="h-4 w-36 mt-2" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-5 w-28" /></CardHeader><CardContent><Skeleton className="h-8 w-12" /><Skeleton className="h-4 w-28 mt-2" /></CardContent></Card>
        </div>
        <div>
          <Skeleton className="h-8 w-64 mb-4" />
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><Skeleton className="h-5 w-20" /></TableHead>
                  <TableHead><Skeleton className="h-5 w-24" /></TableHead>
                  <TableHead className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableHead>
                  <TableHead className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableHead>
                  <TableHead className="text-right"><Skeleton className="h-5 w-24 ml-auto" /></TableHead>
                  <TableHead className="text-right"><Skeleton className="h-5 w-24 ml-auto" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Stat Widgets */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tổng số KOC</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.kocCount}</div>
            <p className="text-xs text-muted-foreground">Số lượng KOC đã tạo</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Kịch bản Automation
            </CardTitle>
            <Bot className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.campaignCount}</div>
            <p className="text-xs text-muted-foreground">
              Số lượng automation đã tạo
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Video đã tạo</CardTitle>
            <Video className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.videoCount}</div>
            <p className="text-xs text-muted-foreground">
              Tổng số video đã tạo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* KOC List */}
      <div>
        <h2 className="text-3xl font-bold mb-4">Danh sách KOC</h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên KOC</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="text-right">Followers</TableHead>
                <TableHead className="text-right">Likes</TableHead>
                <TableHead className="text-right">Video nguồn</TableHead>
                <TableHead className="text-right">Video đã tạo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kocs.length > 0 ? (
                kocs.map((koc) => (
                  <TableRow key={koc.id}>
                    <TableCell className="font-medium">{koc.name}</TableCell>
                    <TableCell>
                      {format(new Date(koc.created_at), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      {koc.follower_count.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {koc.like_count.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {koc.video_count.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {koc.generated_video_count.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    Chưa có KOC nào.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;