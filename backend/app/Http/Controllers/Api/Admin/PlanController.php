<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\SubscriptionPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlanController extends Controller
{
    /**
     * Display a listing of plans.
     */
    public function index(): JsonResponse
    {
        $plans = SubscriptionPlan::orderBy('price', 'asc')->get();

        return response()->json($plans);
    }

    /**
     * Store a newly created plan.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'price' => ['required', 'numeric', 'min:0'],
            'monthly_video_limit' => ['required', 'integer', 'min:0'],
            'monthly_voice_limit' => ['required', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $plan = SubscriptionPlan::create($validated);

        return response()->json($plan, 201);
    }

    /**
     * Display the specified plan.
     */
    public function show(SubscriptionPlan $plan): JsonResponse
    {
        return response()->json($plan);
    }

    /**
     * Update the specified plan.
     */
    public function update(Request $request, SubscriptionPlan $plan): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'monthly_video_limit' => ['sometimes', 'integer', 'min:0'],
            'monthly_voice_limit' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $plan->update($validated);

        return response()->json($plan);
    }

    /**
     * Remove the specified plan.
     */
    public function destroy(SubscriptionPlan $plan): JsonResponse
    {
        // Check if plan has active subscriptions
        if ($plan->subscriptions()->exists()) {
            return response()->json([
                'success' => false,
                'error' => 'Không thể xóa gói đang có người sử dụng.',
            ], 400);
        }

        $plan->delete();

        return response()->json(['success' => true]);
    }
}
