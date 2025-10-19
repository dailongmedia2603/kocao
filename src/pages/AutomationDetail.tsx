import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

// Icons
import { ArrowLeft, Calendar, FileText, Mic, Video, CheckCircle, Loader2, AlertCircle, Clock } from "lucide-react";

// Types
type ActivityLog = {
    activity_date: string;
    idea_id: string;
    idea_content: string;
    idea_status: string;
    idea_created_at: string;
    voice_task_id: string | null;
    voice_status: string | null;
    voice_audio_url: string | null;
    dreamface_task_id: string | null;
    dreamface_status: string | null;
    video_file_id: string | null;
    video_display_name: string | null;
    video_thumbnail_url: string | null;
    video_url: string | null;
};

const TimelineStep = ({ icon: Icon, title, status, children, statusColor }) => (
    <div className="flex gap-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${statusColor.bg}`}>
            <Icon className={`h-5 w-5 ${statusColor.text}`} />
        </div>
        <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
                <p className="font-semibold">{title}</p>
                <Badge variant="outline" className="text-xs">{status}</Badge>
            </div>
            <div className="text-sm text-muted-foreground">{children}</div>
        </div>
    </div>
);

const AutomationDetail = () => {
    const { campaignId } = useParams<{ campaignId: string }>();

    const { data: campaign, isLoading: isLoadingCampaign } = useQuery({
        queryKey: ['automation_campaign', campaignId],
        queryFn: async () => {
            const { data, error } = await supabase.from('automation_campaigns').select('name').eq('id', campaignId!).single();
            if (error) throw error;
            return data;
        },
        enabled: !!campaignId,
    });

    const { data: activities, isLoading: isLoadingActivities } = useQuery<ActivityLog[]>({
        queryKey: ['campaign_activity_log', campaignId],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_campaign_activity_log', { p_campaign_id: campaignId });
            if (error) throw error;
            return data || [];
        },
        enabled: !!campaignId,
    });

    const groupedActivities = useMemo(() => {
        if (!activities) return {};
        return activities.reduce((acc, activity) => {
            const date = format(new Date(activity.activity_date), 'PPP', { locale: vi });
            if (!acc[date]) {
                acc[date] = [];
            }
            acc[date].push(activity);
            return acc;
        }, {} as Record<string, ActivityLog[]>);
    }, [activities]);

    const getStatusInfo = (status: string | null) => {
        switch (status) {
            case 'done':
            case 'completed':
                return { text: 'Hoàn thành', Icon: CheckCircle, color: { bg: 'bg-green-100', text: 'text-green-600' } };
            case 'doing':
            case 'processing':
                return { text: 'Đang xử lý', Icon: Loader2, color: { bg: 'bg-blue-100', text: 'text-blue-600' } };
            case 'failed':
            case 'error':
                return { text: 'Thất bại', Icon: AlertCircle, color: { bg: 'bg-red-100', text: 'text-red-600' } };
            default:
                return { text: 'Đang chờ', Icon: Clock, color: { bg: 'bg-gray-100', text: 'text-gray-600' } };
        }
    };

    return (
        <div className="p-6 lg:p-8">
            <Link to="/automation" className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại danh sách chiến dịch
            </Link>
            <header className="mb-6">
                {isLoadingCampaign ? <Skeleton className="h-9 w-1/3" /> : <h1 className="text-3xl font-bold">{campaign?.name}</h1>}
                <p className="text-muted-foreground mt-1">Nhật ký hoạt động chi tiết của chiến dịch.</p>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle>Dòng thời gian hoạt động</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoadingActivities ? (
                        <div className="space-y-4">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-24 w-full" />
                        </div>
                    ) : Object.keys(groupedActivities).length > 0 ? (
                        <Accordion type="multiple" defaultValue={Object.keys(groupedActivities).slice(0, 1)} className="w-full space-y-4">
                            {Object.entries(groupedActivities).map(([date, activitiesForDate]) => (
                                <AccordionItem key={date} value={date} className="border rounded-lg">
                                    <AccordionTrigger className="p-4 hover:no-underline">
                                        <div className="flex items-center gap-3">
                                            <Calendar className="h-5 w-5 text-primary" />
                                            <span className="font-semibold">{date}</span>
                                            <Badge variant="secondary">{activitiesForDate.length} hoạt động</Badge>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="p-4 border-t">
                                        <div className="space-y-6">
                                            {activitiesForDate.map(activity => (
                                                <div key={activity.idea_id} className="p-4 border rounded-md space-y-4">
                                                    <TimelineStep icon={FileText} title="Ý tưởng" status="Đã xử lý" statusColor={getStatusInfo('completed').color}>
                                                        <p className="line-clamp-2">{activity.idea_content}</p>
                                                    </TimelineStep>
                                                    <TimelineStep icon={Mic} title="Tạo Voice" status={getStatusInfo(activity.voice_status).text} statusColor={getStatusInfo(activity.voice_status).color}>
                                                        {activity.voice_audio_url && <audio controls src={activity.voice_audio_url} className="h-8 w-full" />}
                                                    </TimelineStep>
                                                    <TimelineStep icon={Video} title="Tạo Video" status={getStatusInfo(activity.dreamface_status).text} statusColor={getStatusInfo(activity.dreamface_status).color}>
                                                        {activity.video_url ? (
                                                            <video
                                                                controls
                                                                src={activity.video_url}
                                                                poster={activity.video_thumbnail_url || undefined}
                                                                className="w-full max-w-xs rounded-lg"
                                                            />
                                                        ) : activity.video_thumbnail_url && (
                                                            <div className="flex items-center gap-2">
                                                                <img src={activity.video_thumbnail_url} alt="thumbnail" className="h-12 w-12 rounded-md object-cover" />
                                                                <p className="font-medium">{activity.video_display_name}</p>
                                                            </div>
                                                        )}
                                                    </TimelineStep>
                                                </div>
                                            ))}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : (
                        <div className="text-center py-16 text-muted-foreground">
                            <p>Chưa có hoạt động nào cho chiến dịch này.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default AutomationDetail;