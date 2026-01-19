import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const VideoSelectionPage = () => {
    const navigate = useNavigate();

    const options = [
        {
            title: "Sao chép người thật",
            description: "Tạo video từ mẫu người thật với giọng nói và cử chỉ tự nhiên.",
            icon: Users,
            path: "/tao-video/clone",
            color: "text-blue-600",
            bgColor: "bg-blue-50",
            borderColor: "hover:border-blue-200",
        },
        {
            title: "Sáng tạo KOC",
            description: "Tạo nhân vật KOC ảo hoàn toàn mới theo ý tưởng của bạn.",
            icon: Sparkles,
            path: "/tao-video/create-koc",
            color: "text-purple-600",
            bgColor: "bg-purple-50",
            borderColor: "hover:border-purple-200",
        }
    ];

    return (
        <div className="p-6 lg:p-8 space-y-8">
            <header>
                <h1 className="text-3xl font-bold">Chọn Loại Video</h1>
                <p className="text-muted-foreground mt-1">Chọn phương thức tạo video phù hợp với nhu cầu của bạn.</p>
            </header>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mt-12">
                {options.map((option) => (
                    <Card
                        key={option.title}
                        className={cn(
                            "cursor-pointer transition-all duration-300 hover:shadow-lg border-2 border-transparent",
                            option.borderColor
                        )}
                        onClick={() => navigate(option.path)}
                    >
                        <CardHeader className="text-center pb-2">
                            <div className={cn(
                                "mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4",
                                option.bgColor,
                                option.color
                            )}>
                                <option.icon className="w-8 h-8" />
                            </div>
                            <CardTitle className="text-xl">{option.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="text-center">
                            <CardDescription className="text-base mb-6">
                                {option.description}
                            </CardDescription>
                            <div className={cn(
                                "inline-flex items-center text-sm font-medium",
                                option.color
                            )}>
                                Bắt đầu ngay <ArrowRight className="ml-1 w-4 h-4" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default VideoSelectionPage;
