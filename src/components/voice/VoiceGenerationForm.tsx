import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Wand2 } from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import { Slider } from "@/components/ui/slider";

const formSchema = z.object({
  text: z.string().min(1, "Văn bản không được để trống."),
  voice_id: z.string().min(1, "Vui lòng chọn một giọng nói."),
  model: z.string().min(1, "Vui lòng chọn một model."),
  speed: z.number().min(0.5).max(2.0).default(1.0),
});

const fetchVoices = async () => {
  const { data, error } = await supabase.functions.invoke("list-minimax-voices");
  if (error) throw error;
  return data;
};

export const VoiceGenerationForm = () => {
  const queryClient = useQueryClient();
  const { data: voices, isLoading: isLoadingVoices } = useQuery({ queryKey: ["minimax_voices"], queryFn: fetchVoices, staleTime: Infinity });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { text: "", voice_id: "", model: "speech-01", speed: 1.0 },
  });

  const createVoiceMutation = useMutation({
    mutationFn: (values: z.infer<typeof formSchema>) => supabase.functions.invoke("generate-minimax-voice", { body: values }),
    onSuccess: () => {
      showSuccess("Tạo voice thành công!");
      queryClient.invalidateQueries({ queryKey: ["voice_history"] });
      form.reset({ ...form.getValues(), text: "" });
    },
    onError: (error: any) => showError(`Tạo voice thất bại: ${error.context?.error_message || error.message}`),
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => createVoiceMutation.mutate(values);

  return (
    <Card>
      <CardHeader><CardTitle>Tạo Giọng Nói Mới</CardTitle><CardDescription>Nhập văn bản và chọn giọng nói để bắt đầu.</CardDescription></CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={form.control} name="text" render={({ field }) => (
              <FormItem><FormLabel>Văn bản</FormLabel><FormControl><Textarea placeholder="Xin chào, đây là Minimax..." className="min-h-[150px]" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="voice_id" render={({ field }) => (
              <FormItem><FormLabel>Giọng nói</FormLabel>
                {isLoadingVoices ? <Skeleton className="h-10 w-full" /> : (
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Chọn một giọng nói" /></SelectTrigger></FormControl>
                    <SelectContent>{voices?.map((voice: any) => (<SelectItem key={voice.voice_id} value={voice.voice_id}>{voice.name}</SelectItem>))}</SelectContent>
                  </Select>
                )}<FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="model" render={({ field }) => (
              <FormItem><FormLabel>Model</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="speech-01">Speech-01</SelectItem><SelectItem value="speech-01-pro">Speech-01 Pro</SelectItem></SelectContent>
                </Select><FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="speed" render={({ field }) => (
              <FormItem><FormLabel>Tốc độ: {field.value.toFixed(1)}x</FormLabel>
                <FormControl><Slider defaultValue={[1.0]} min={0.5} max={2.0} step={0.1} onValueChange={(val) => field.onChange(val[0])} /></FormControl>
              </FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={createVoiceMutation.isPending}>
              {createVoiceMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}Tạo Voice
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};