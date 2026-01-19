<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContentPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContentPlanController extends Controller
{
    /**
     * Display a listing of content plans.
     */
    public function index(Request $request): JsonResponse
    {
        $plans = ContentPlan::where('user_id', $request->user()->id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($plans);
    }

    /**
     * Store a newly created plan.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'content' => ['nullable', 'array'],
            'status' => ['sometimes', 'in:draft,active'],
        ]);

        $plan = ContentPlan::create([
            ...$validated,
            'user_id' => $request->user()->id,
        ]);

        return response()->json($plan, 201);
    }

    /**
     * Display the specified plan.
     */
    public function show(Request $request, ContentPlan $contentPlan): JsonResponse
    {
        if ((string) $contentPlan->user_id !== (string) $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return response()->json($contentPlan);
    }

    /**
     * Update the specified plan.
     */
    public function update(Request $request, ContentPlan $contentPlan): JsonResponse
    {
        if ((string) $contentPlan->user_id !== (string) $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'content' => ['nullable', 'array'],
            'status' => ['sometimes', 'in:draft,active'],
        ]);

        $contentPlan->update($validated);

        return response()->json($contentPlan);
    }

    /**
     * Remove the specified plan.
     */
    public function destroy(Request $request, ContentPlan $contentPlan): JsonResponse
    {
        if ((string) $contentPlan->user_id !== (string) $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $contentPlan->delete();

        return response()->json(['success' => true]);
    }

    /**
     * Generate a new content plan using AI.
     */
    public function generate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'topic' => ['required', 'string'],
            'duration' => ['sometimes', 'string'],
            'koc_id' => ['nullable', 'uuid'],
        ]);

        // TODO: Dispatch AI generation job

        return response()->json([
            'success' => true,
            'message' => 'Đang tạo kế hoạch...',
        ]);
    }

    /**
     * Generate more ideas for a plan.
     */
    /**
     * Generate more ideas for a plan.
     */
    public function generateMoreIdeas(Request $request, ContentPlan $contentPlan): JsonResponse
    {
        // Use string cast for proper UUID comparison
        if ((string) $contentPlan->user_id !== (string) $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Get KOC
        $kocId = $contentPlan->content['kocId'] ?? $contentPlan->content['koc_id'] ?? null;
        if (!$kocId) {
            return response()->json(['success' => false, 'error' => 'No KOC linked to this plan'], 400);
        }
        
        $koc = \App\Models\Koc::find($kocId);
        if (!$koc) {
            return response()->json(['success' => false, 'error' => 'KOC not found'], 404);
        }

        // Generate ideas using service
        $generationService = app(\App\Services\ContentGenerationService::class);
        $ideas = $generationService->generateMoreIdeas($koc, 5, $request->user()->id);
        
        // Append to plan content
        $currentContent = $contentPlan->content;
        $currentIdeas = $currentContent['results']['ideas'] ?? [];
        
        // Map simple ideas to structure if needed or just append
        // Service returns [{"idea": "..."}] usually, but let's check format
        // The service prompts for [{"idea": "..."}]
        // Plan format expects { "title": "...", "format": "...", "description": "..." }
        
        // We might need to map or trust the prompt output.
        // The prompt in service asks for json array.
        
        $newIdeasFormatted = array_map(function($item) {
             return [
                 'title' => $item['idea'] ?? $item['title'] ?? 'New Idea',
                 'format' => $item['format'] ?? 'Short Video',
                 'description' => $item['description'] ?? $item['idea'] ?? '',
             ];
        }, $ideas);

        $currentIdeas = array_merge($currentIdeas, $newIdeasFormatted);
        
        $currentContent['results']['ideas'] = $currentIdeas;
        
        $contentPlan->update(['content' => $currentContent]);

        return response()->json([
            'success' => true,
            'message' => 'Đã tạo thêm ý tưởng mới!',
            'data' => $newIdeasFormatted
        ]);
    }
}
