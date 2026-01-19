<?php

namespace App\Jobs;

use App\Models\AutomationCampaign;
use App\Models\DreamfaceTask;
use App\Models\Koc;
use App\Models\KocContentIdea;
use App\Models\User;
use App\Services\DreamfaceApiService;
use App\Services\SubscriptionService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class AutoVoiceToVideo implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 1;

    /**
     * Create a new job instance.
     */
    public function __construct() {}

    /**
     * Execute the job.
     */
    public function handle(DreamfaceApiService $dreamfaceService, SubscriptionService $subscriptionService): void
    {
        // Get active automation campaigns
        $campaigns = AutomationCampaign::where('status', 'active')
            ->with(['koc.files'])
            ->get();

        if ($campaigns->isEmpty()) {
            \Log::info('AutoVoiceToVideo: No active campaigns');
            return;
        }

        $processedCount = 0;

        foreach ($campaigns as $campaign) {
            // Find ideas with voice ready but no video yet
            $ideas = KocContentIdea::where('koc_id', $campaign->koc_id)
                ->where('status', KocContentIdea::STATUS_VOICE_READY)
                ->whereNull('dreamface_task_id')
                ->whereNotNull('voice_audio_url')
                ->limit(2) // Process max 2 per campaign per run
                ->get();

            foreach ($ideas as $idea) {
                try {
                    $this->processIdea($idea, $campaign, $dreamfaceService, $subscriptionService);
                    $processedCount++;
                } catch (\Exception $e) {
                    \Log::error("AutoVoiceToVideo failed for idea {$idea->id}: " . $e->getMessage());
                }

                // Delay between API calls
                sleep(1);
            }
        }

        \Log::info("AutoVoiceToVideo completed: Processed {$processedCount} ideas");
    }

    /**
     * Process a single idea.
     */
    protected function processIdea(
        KocContentIdea $idea,
        AutomationCampaign $campaign,
        DreamfaceApiService $dreamfaceService,
        SubscriptionService $subscriptionService
    ): void {
        $user = User::find($idea->user_id);
        $koc = Koc::with('files')->find($idea->koc_id);
        
        if (!$user || !$koc) {
            throw new \Exception("User or KOC not found for idea {$idea->id}");
        }

        // Check credits
        if (!$subscriptionService->canCreateVideo($user)) {
            \Log::warning("AutoVoiceToVideo: User {$user->id} has no video credits");
            return;
        }

        // Get a video file from KOC (rotate based on last_used_at)
        $kocFile = $koc->files()
            ->where('display_name', 'REGEXP', '\\.(mp4|mov|webm|avi)$')
            ->orderByRaw('COALESCE(last_used_at, "1970-01-01") ASC')
            ->first();

        if (!$kocFile) {
            \Log::warning("AutoVoiceToVideo: KOC {$koc->id} has no video files");
            return;
        }

        // Deduct credit
        if (!$subscriptionService->deductVideoCredit($user)) {
            return;
        }

        $idea->update(['status' => KocContentIdea::STATUS_CREATING_VIDEO]);

        try {
            // Mark file as used
            $kocFile->update(['last_used_at' => now()]);

            // Create Dreamface task
            $task = DreamfaceTask::create([
                'user_id' => $user->id,
                'koc_id' => $koc->id,
                'idea_id' => $idea->id,
                'original_video_url' => $kocFile->publicUrl,
                'original_audio_url' => $idea->voice_audio_url,
                'status' => DreamfaceTask::STATUS_PENDING,
            ]);

            // Update idea
            $idea->update(['dreamface_task_id' => $task->id]);

            // Process the task
            $dreamfaceService->processTask($task);

            \Log::info("AutoVoiceToVideo: Created video task for idea {$idea->id}");

        } catch (\Exception $e) {
            // Refund credit
            $subscriptionService->refundVideoCredit($user);

            $idea->update([
                'status' => KocContentIdea::STATUS_VIDEO_ERROR,
                'error_message' => $e->getMessage(),
            ]);

            throw $e;
        }
    }
}
