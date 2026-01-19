<?php

namespace App\Jobs;

use App\Models\VoiceTask;
use App\Services\VoiceApiService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;

class SyncVoiceTasks implements ShouldQueue
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
    public function handle(VoiceApiService $voiceService): void
    {
        // Get all 'doing' voice tasks
        $tasks = VoiceTask::where('status', VoiceTask::STATUS_DOING)
            ->where('created_at', '>', now()->subDays(7)) // Only last 7 days
            ->limit(50)
            ->get();

        if ($tasks->isEmpty()) {
            \Log::info('SyncVoiceTasks: No pending tasks to sync');
            return;
        }

        $syncedCount = 0;
        $completedCount = 0;

        foreach ($tasks as $task) {
            try {
                $status = $voiceService->getTaskStatus($task->id, $task->user_id);

                // Update task based on status
                $updateData = [];

                if (isset($status['status'])) {
                    if ($status['status'] === 'done' || $status['status'] === 'completed') {
                        $updateData['status'] = VoiceTask::STATUS_DONE;
                        $completedCount++;
                    } elseif ($status['status'] === 'error' || $status['status'] === 'failed') {
                        $updateData['status'] = VoiceTask::STATUS_ERROR;
                        $updateData['error_message'] = $status['error_message'] ?? 'Unknown error';
                    }
                }

                if (isset($status['audio_url'])) {
                    $updateData['audio_url'] = $status['audio_url'];
                } elseif (isset($status['metadata']['audio_url'])) {
                    // API sometimes returns audio_url inside metadata
                    $updateData['audio_url'] = $status['metadata']['audio_url'];
                }

                if (isset($status['srt_url'])) {
                    $updateData['srt_url'] = $status['srt_url'];
                }

                if (!empty($updateData)) {
                    $task->update($updateData);

                    // Update linked idea if completed
                    if (($updateData['status'] ?? '') === VoiceTask::STATUS_DONE && isset($updateData['audio_url'])) {
                        $this->updateLinkedIdea($task, $updateData['audio_url']);
                        
                        // Update ClonedVoice sample_audio if this is a clone_sample task
                        if ($task->task_type === 'clone_sample' && $task->cloned_voice_id) {
                            $this->updateClonedVoiceSample($task->cloned_voice_id, $updateData['audio_url']);
                        }
                    }
                }

                $syncedCount++;

            } catch (\Exception $e) {
                \Log::error("SyncVoiceTasks: Failed to sync task {$task->id}: " . $e->getMessage());
            }

            // Small delay between API calls
            usleep(100000); // 100ms
        }

        \Log::info("SyncVoiceTasks completed: Synced {$syncedCount}, Completed {$completedCount}");
    }

    /**
     * Update the linked idea with voice audio URL.
     */
    protected function updateLinkedIdea(VoiceTask $task, string $audioUrl): void
    {
        DB::table('koc_content_ideas')
            ->where('voice_task_id', $task->id)
            ->update([
                'voice_audio_url' => $audioUrl,
                'status' => \App\Models\KocContentIdea::STATUS_VOICE_READY,
                'updated_at' => now(),
            ]);
    }

    /**
     * Update the cloned voice sample audio URL.
     */
    protected function updateClonedVoiceSample(string $voiceId, string $audioUrl): void
    {
        $updated = DB::table('cloned_voices')
            ->where('voice_id', $voiceId)
            ->whereNull('sample_audio')
            ->update([
                'sample_audio' => $audioUrl,
                'updated_at' => now(),
            ]);

        if ($updated) {
            \Log::info("SyncVoiceTasks: Updated sample_audio for cloned voice {$voiceId}");
        }
    }
}
