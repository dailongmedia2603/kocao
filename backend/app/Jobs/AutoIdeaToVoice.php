<?php

namespace App\Jobs;

use App\Models\AutomationCampaign;
use App\Models\Koc;
use App\Models\KocContentIdea;
use App\Models\User;
use App\Services\SubscriptionService;
use App\Services\VoiceApiService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class AutoIdeaToVoice implements ShouldQueue
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
    public function handle(VoiceApiService $voiceService, SubscriptionService $subscriptionService): void
    {
        // Get active automation campaigns
        $campaigns = AutomationCampaign::where('status', 'active')
            ->with(['koc', 'aiTemplate'])
            ->get();

        if ($campaigns->isEmpty()) {
            \Log::info('AutoIdeaToVoice: No active campaigns');
            return;
        }

        $processedCount = 0;

        foreach ($campaigns as $campaign) {
            // Find ideas with content ready but no voice yet
            $ideas = KocContentIdea::where('koc_id', $campaign->koc_id)
                ->where('status', KocContentIdea::STATUS_CONTENT_READY)
                ->whereNull('voice_task_id')
                ->whereNotNull('new_content')
                ->limit(3) // Process max 3 per campaign per run
                ->get();

            foreach ($ideas as $idea) {
                try {
                    $this->processIdea($idea, $campaign, $voiceService, $subscriptionService);
                    $processedCount++;
                } catch (\Exception $e) {
                    \Log::error("AutoIdeaToVoice failed for idea {$idea->id}: " . $e->getMessage());
                }

                // Delay between API calls
                usleep(500000); // 500ms
            }
        }

        \Log::info("AutoIdeaToVoice completed: Processed {$processedCount} ideas");
    }

    /**
     * Process a single idea.
     */
    protected function processIdea(
        KocContentIdea $idea,
        AutomationCampaign $campaign,
        VoiceApiService $voiceService,
        SubscriptionService $subscriptionService
    ): void {
        $user = User::find($idea->user_id);
        
        if (!$user) {
            throw new \Exception("User not found for idea {$idea->id}");
        }

        // Check credits
        if (!$subscriptionService->canCreateVoice($user)) {
            \Log::warning("AutoIdeaToVoice: User {$user->id} has no voice credits");
            return;
        }

        // Deduct credit
        if (!$subscriptionService->deductVoiceCredit($user)) {
            return;
        }

        $idea->update(['status' => KocContentIdea::STATUS_CREATING_VOICE]);

        try {
            // Use campaign's voice settings
            $voiceSettings = [];
            if ($campaign->cloned_voice_id) {
                $voiceSettings['voice_id'] = $campaign->cloned_voice_id;
            }

            $result = $voiceService->textToSpeech($user, [
                'text' => $idea->new_content,
                'voice_name' => $campaign->cloned_voice_name ?? 'default',
                'voice_setting' => $voiceSettings,
            ]);

            // Update idea
            $idea->update([
                'voice_task_id' => $result['task_id'] ?? null,
            ]);

            \Log::info("AutoIdeaToVoice: Created voice task for idea {$idea->id}");

        } catch (\Exception $e) {
            // Refund credit
            $subscriptionService->refundVoiceCredit($user);

            $idea->update([
                'status' => KocContentIdea::STATUS_VOICE_ERROR,
                'error_message' => $e->getMessage(),
            ]);

            throw $e;
        }
    }
}
