<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DreamfaceTask;
use App\Services\SubscriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DreamfaceController extends Controller
{
    public function __construct(
        protected SubscriptionService $subscriptionService
    ) {}

    /**
     * Get list of dreamface tasks for current user.
     */
    public function tasks(Request $request): JsonResponse
    {
        $tasks = DreamfaceTask::where('user_id', $request->user()->id)
            ->with(['koc', 'idea'])
            ->orderBy('created_at', 'desc')
            ->limit(100)
            ->get();

        return response()->json($tasks);
    }

    /**
     * Create a new video generation task.
     */
    public function create(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'koc_id' => ['required', 'uuid'],
            'video_url' => ['required', 'url'],
            'audio_url' => ['required', 'url'],
            'idea_id' => ['nullable', 'uuid'],
        ]);

        // Check video credits
        if (!$this->subscriptionService->canCreateVideo($request->user())) {
            return response()->json([
                'success' => false,
                'error' => 'Bạn đã hết lượt tạo video trong tháng này.',
            ], 403);
        }

        // Verify KOC ownership
        $koc = \App\Models\Koc::find($validated['koc_id']);
        if (!$koc || $koc->user_id !== $request->user()->id) {
            return response()->json([
                'success' => false,
                'error' => 'KOC không tồn tại hoặc không có quyền truy cập.',
            ], 403);
        }

        try {
            // Deduct credit
            if (!$this->subscriptionService->deductVideoCredit($request->user())) {
                return response()->json([
                    'success' => false,
                    'error' => 'Không thể trừ credit.',
                ], 403);
            }

            // Create task
            $task = DreamfaceTask::create([
                'user_id' => $request->user()->id,
                'koc_id' => $validated['koc_id'],
                'idea_id' => $validated['idea_id'] ?? null,
                'original_video_url' => $validated['video_url'],
                'original_audio_url' => $validated['audio_url'],
                'status' => DreamfaceTask::STATUS_PENDING,
            ]);

            // Update idea status if linked
            if ($validated['idea_id']) {
                \App\Models\KocContentIdea::where('id', $validated['idea_id'])
                    ->update([
                        'dreamface_task_id' => $task->id,
                        'status' => \App\Models\KocContentIdea::STATUS_CREATING_VIDEO,
                    ]);
            }

            // TODO: Dispatch ProcessDreamfaceQueue job

            return response()->json([
                'success' => true,
                'task' => $task,
            ], 201);

        } catch (\Exception $e) {
            // Refund credit on error
            $this->subscriptionService->refundVideoCredit($request->user());

            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete a task.
     */
    public function destroy(Request $request, DreamfaceTask $task): JsonResponse
    {
        // Check ownership
        if ($task->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $task->delete();

        return response()->json(['success' => true]);
    }

    /**
     * Get download URL for completed video.
     */
    public function downloadUrl(Request $request, DreamfaceTask $task): JsonResponse
    {
        // Check ownership
        if ($task->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if (!$task->result_video_url) {
            return response()->json([
                'success' => false,
                'error' => 'Video chưa hoàn thành.',
            ], 400);
        }

        return response()->json([
            'url' => $task->result_video_url,
        ]);
    }

    /**
     * Archive video to KOC files.
     */
    public function archive(Request $request, DreamfaceTask $task): JsonResponse
    {
        // Check ownership
        if ($task->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if (!$task->result_video_url) {
            return response()->json([
                'success' => false,
                'error' => 'Video chưa hoàn thành.',
            ], 400);
        }

        // TODO: Download video from result_video_url and upload to R2
        // Create KocFile record

        return response()->json([
            'success' => true,
            'message' => 'Đang lưu video vào thư viện...',
        ]);
    }
}
