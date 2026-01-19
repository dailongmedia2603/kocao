<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Koc;
use App\Services\R2StorageService;
use App\Services\TiktokApiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class KocController extends Controller
{
    public function __construct(
        protected TiktokApiService $tiktokService,
        protected R2StorageService $r2Service
    ) {}

    /**
     * Display a listing of the KOCs.
     */
    public function index(Request $request): JsonResponse
    {
        $kocs = Koc::where('user_id', $request->user()->id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($kocs);
    }

    /**
     * Get KOCs with video count stats.
     */
    public function withStats(Request $request): JsonResponse
    {
        $kocs = Koc::where('user_id', $request->user()->id)
            ->withCount('files')
            ->withCount('ideas')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($kocs);
    }

    /**
     * Store a newly created KOC.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'field' => ['nullable', 'string', 'max:255'],
            'avatar_url' => ['nullable', 'string', 'url'],
            'channel_url' => ['nullable', 'string', 'url'],
        ]);

        $koc = Koc::create([
            ...$validated,
            'user_id' => $request->user()->id,
            'folder_path' => 'kocs/' . $request->user()->id . '/' . uniqid(),
        ]);

        // Auto-scan TikTok stats if channel URL provided
        if (!empty($validated['channel_url'])) {
            try {
                $this->tiktokService->scanKocStats($koc);
            } catch (\Exception $e) {
                \Log::warning("Failed to auto-scan KOC stats: " . $e->getMessage());
            }
        }

        return response()->json($koc->fresh(), 201);
    }

    /**
     * Display the specified KOC.
     */
    public function show(Request $request, Koc $koc): JsonResponse
    {
        // Check ownership
        if ($koc->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $koc->load(['defaultPromptTemplate', 'defaultClonedVoice']);

        return response()->json($koc);
    }

    /**
     * Update the specified KOC.
     */
    public function update(Request $request, Koc $koc): JsonResponse
    {
        // Check ownership
        if ($koc->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'field' => ['nullable', 'string', 'max:255'],
            'avatar_url' => ['nullable', 'string'],
            'channel_url' => ['nullable', 'string'],
            'default_prompt_template_id' => ['nullable', 'uuid'],
            'default_cloned_voice_id' => ['nullable', 'string'],
        ]);

        $koc->update($validated);

        return response()->json($koc);
    }

    /**
     * Remove the specified KOC.
     */
    public function destroy(Request $request, Koc $koc): JsonResponse
    {
        // Check ownership
        if ($koc->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Delete R2 files
        foreach ($koc->files as $file) {
            try {
                $this->r2Service->delete($file->r2_key);
            } catch (\Exception $e) {
                \Log::warning("Failed to delete R2 file {$file->r2_key}: " . $e->getMessage());
            }
        }
        
        $koc->delete();

        return response()->json(['message' => 'Xóa KOC thành công.']);
    }

    /**
     * Scan KOC stats from TikTok.
     */
    public function scanStats(Request $request, Koc $koc): JsonResponse
    {
        // Check ownership
        if ($koc->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if (!$koc->channel_url) {
            return response()->json(['message' => 'KOC chưa có channel URL.'], 400);
        }

        try {
            $success = $this->tiktokService->scanKocStats($koc);

            if ($success) {
                return response()->json([
                    'success' => true,
                    'message' => 'Đã cập nhật thông tin kênh thành công.',
                    'koc' => $koc->fresh(),
                ]);
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Không thể lấy thông tin kênh từ TikTok.',
                ], 400);
            }

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi: ' . $e->getMessage(),
            ], 500);
        }
    }
}

