<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Profile;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    /**
     * Display a listing of all users.
     */
    public function index(Request $request): JsonResponse
    {
        $users = User::with(['profile', 'subscription.plan'])
            ->orderBy('created_at', 'desc')
            ->paginate(50);

        return response()->json($users);
    }

    /**
     * Store a newly created user.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'first_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['nullable', 'string', 'max:255'],
            'role' => ['nullable', 'in:user,admin'],
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => bcrypt($validated['password']),
            'email_verified_at' => now(),
        ]);

        $user->profile()->create([
            'first_name' => $validated['first_name'] ?? null,
            'last_name' => $validated['last_name'] ?? null,
            'role' => $validated['role'] ?? 'user',
            'status' => 'active',
        ]);

        return response()->json($user->load('profile'), 201);
    }

    /**
     * Update the specified user.
     */
    public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'unique:users,email,' . $user->id],
            'profile.role' => ['sometimes', 'in:user,admin'],
            'profile.status' => ['sometimes', 'in:pending,active,banned'],
            'subscription_plan_id' => ['sometimes', 'nullable', 'string'],
        ]);

        if (isset($validated['name']) || isset($validated['email'])) {
            $user->update([
                'name' => $validated['name'] ?? $user->name,
                'email' => $validated['email'] ?? $user->email,
            ]);
        }

        if (isset($validated['profile'])) {
            $user->profile()->updateOrCreate(
                ['user_id' => $user->id],
                $validated['profile']
            );
        }

        // Handle subscription plan assignment
        if (array_key_exists('subscription_plan_id', $validated)) {
            $planId = $validated['subscription_plan_id'];
            
            if ($planId) {
                // Create or update subscription
                $user->subscription()->updateOrCreate(
                    ['user_id' => $user->id],
                    [
                        'plan_id' => $planId,
                        'status' => 'active',
                        'current_period_start' => now()->startOfDay(),
                        'current_period_end' => now()->addYear()->endOfDay(),
                        'current_period_videos_used' => 0,
                        'current_period_voices_used' => 0,
                    ]
                );
            } else {
                // Remove subscription
                $user->subscription()->delete();
            }
        }

        return response()->json($user->load(['profile', 'subscription.plan']));
    }

    /**
     * Remove the specified user.
     */
    public function destroy(Request $request, User $user): JsonResponse
    {
        // Prevent self-deletion
        if ($user->id === $request->user()->id) {
            return response()->json([
                'success' => false,
                'error' => 'Không thể xóa chính mình.',
            ], 400);
        }

        // TODO: Clean up user's R2 files
        
        $user->delete();

        return response()->json(['success' => true]);
    }
}
