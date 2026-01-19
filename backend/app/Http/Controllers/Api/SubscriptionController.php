<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SubscriptionPlan;
use App\Services\SubscriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubscriptionController extends Controller
{
    public function __construct(
        protected SubscriptionService $subscriptionService
    ) {}

    /**
     * Get current user's subscription.
     */
    public function current(Request $request): JsonResponse
    {
        $info = $this->subscriptionService->getSubscriptionInfo($request->user());

        if (!$info) {
            return response()->json([
                'message' => 'Chưa có gói đăng ký.',
                'subscription' => null,
            ]);
        }

        return response()->json([
            'subscription' => $info,
        ]);
    }

    /**
     * Get available subscription plans.
     */
    public function plans(): JsonResponse
    {
        $plans = SubscriptionPlan::active()
            ->orderBy('price', 'asc')
            ->get();

        return response()->json($plans);
    }
}
