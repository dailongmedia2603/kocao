<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TranscriptionTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TranscriptionController extends Controller
{
    /**
     * Display a listing of transcription tasks.
     */
    public function index(Request $request): JsonResponse
    {
        $tasks = TranscriptionTask::where('user_id', $request->user()->id)
            ->orderBy('created_at', 'desc')
            ->limit(100)
            ->get();

        return response()->json($tasks);
    }

    /**
     * Start a new transcription task.
     */
    public function start(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'video_url' => ['required', 'url'],
            'video_name' => ['required', 'string', 'max:255'],
        ]);

        $task = TranscriptionTask::create([
            'user_id' => $request->user()->id,
            'video_url' => $validated['video_url'],
            'video_name' => $validated['video_name'],
            'status' => TranscriptionTask::STATUS_PENDING,
        ]);

        // TODO: Dispatch transcription job

        return response()->json($task, 201);
    }

    /**
     * Get channel metadata from URL.
     */
    public function channelMetadata(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'url' => ['required', 'url'],
        ]);

        // TODO: Fetch metadata from TikTok/YouTube

        return response()->json([
            'success' => true,
            'message' => 'Feature coming soon.',
        ]);
    }

    /**
     * Download channel videos for transcription.
     */
    public function downloadChannel(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'url' => ['required', 'url'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);

        // TODO: Start channel download job

        return response()->json([
            'success' => true,
            'message' => 'Feature coming soon.',
        ]);
    }
}
