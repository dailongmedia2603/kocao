<?php

namespace App\Jobs;

use App\Models\DreamfaceTask;
use App\Services\DreamfaceApiService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;

class SyncDreamfaceTasks implements ShouldQueue
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
    public function handle(DreamfaceApiService $dreamfaceService): void
    {
        // Get all 'processing' dreamface tasks
        $tasks = DreamfaceTask::where('status', DreamfaceTask::STATUS_PROCESSING)
            ->whereNotNull('animate_id')
            ->where('created_at', '>', now()->subDays(7))
            ->limit(50)
            ->get();

        if ($tasks->isEmpty()) {
            \Log::info('SyncDreamfaceTasks: No processing tasks to sync');
            return;
        }

        $syncedCount = 0;
        $completedCount = 0;

        foreach ($tasks as $task) {
            try {
                $success = $dreamfaceService->syncTaskStatus($task);

                if ($success) {
                    $syncedCount++;

                    // Check if completed
                    if ($task->fresh()->status === DreamfaceTask::STATUS_COMPLETED) {
                        $completedCount++;
                        $this->updateLinkedIdea($task);
                    }
                }

            } catch (\Exception $e) {
                \Log::error("SyncDreamfaceTasks: Failed to sync task {$task->id}: " . $e->getMessage());
            }

            // Small delay between API calls
            usleep(200000); // 200ms
        }

        \Log::info("SyncDreamfaceTasks completed: Synced {$syncedCount}, Completed {$completedCount}");
    }

    /**
     * Update the linked idea when video is complete.
     */
    protected function updateLinkedIdea(DreamfaceTask $task): void
    {
        if (!$task->idea_id || !$task->result_video_url) {
            return;
        }

        DB::table('koc_content_ideas')
            ->where('id', $task->idea_id)
            ->update([
                'status' => \App\Models\KocContentIdea::STATUS_COMPLETED,
                'updated_at' => now(),
            ]);
    }
}
