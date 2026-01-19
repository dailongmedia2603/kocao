<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AutomationCampaign;
use App\Models\Koc;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AutomationController extends Controller
{
    /**
     * Display a listing of campaigns.
     */
    public function index(Request $request): JsonResponse
    {
        $campaigns = AutomationCampaign::where('user_id', $request->user()->id)
            ->with(['koc', 'aiTemplate'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($campaigns);
    }

    /**
     * Store a newly created campaign.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'koc_id' => ['required', 'uuid'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'cloned_voice_id' => ['nullable', 'string'],
            'cloned_voice_name' => ['nullable', 'string'],
            'ai_template_id' => ['nullable', 'uuid'],
            'model' => ['nullable', 'string'],
            'max_words' => ['nullable', 'integer', 'min:50', 'max:2000'],
        ]);

        // Verify KOC ownership
        $koc = Koc::find($validated['koc_id']);
        if (!$koc || $koc->user_id !== $request->user()->id) {
            return response()->json([
                'success' => false,
                'error' => 'KOC không tồn tại hoặc không có quyền truy cập.',
            ], 403);
        }

        $campaign = AutomationCampaign::create([
            ...$validated,
            'user_id' => $request->user()->id,
            'status' => 'paused',
        ]);

        return response()->json($campaign, 201);
    }

    /**
     * Display the specified campaign.
     */
    public function show(Request $request, AutomationCampaign $campaign): JsonResponse
    {
        // Check ownership
        if ($campaign->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $campaign->load(['koc', 'aiTemplate', 'clonedVoice']);

        return response()->json($campaign);
    }

    /**
     * Update the specified campaign.
     */
    public function update(Request $request, AutomationCampaign $campaign): JsonResponse
    {
        // Check ownership
        if ($campaign->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'cloned_voice_id' => ['nullable', 'string'],
            'cloned_voice_name' => ['nullable', 'string'],
            'ai_template_id' => ['nullable', 'uuid'],
            'model' => ['nullable', 'string'],
            'max_words' => ['nullable', 'integer', 'min:50', 'max:2000'],
            'status' => ['sometimes', 'in:active,paused'],
        ]);

        $campaign->update($validated);

        return response()->json($campaign);
    }

    /**
     * Remove the specified campaign.
     */
    public function destroy(Request $request, AutomationCampaign $campaign): JsonResponse
    {
        // Check ownership
        if ($campaign->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $campaign->delete();

        return response()->json(['success' => true]);
    }

    /**
     * Toggle campaign status.
     */
    public function toggle(Request $request, AutomationCampaign $campaign): JsonResponse
    {
        // Check ownership
        if ($campaign->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $campaign->update([
            'status' => $campaign->status === 'active' ? 'paused' : 'active',
        ]);

        return response()->json([
            'success' => true,
            'status' => $campaign->status,
        ]);
    }

    /**
     * Get activity log for campaign.
     */
    public function activityLog(Request $request, AutomationCampaign $campaign): JsonResponse
    {
        // Check ownership
        if ($campaign->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Get ideas linked to this campaign's KOC
        $ideas = \App\Models\KocContentIdea::where('koc_id', $campaign->koc_id)
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get();

        return response()->json($ideas);
    }
}
