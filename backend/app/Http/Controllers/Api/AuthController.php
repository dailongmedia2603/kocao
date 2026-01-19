<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Profile;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    /**
     * Register a new user.
     */
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
        ]);

        // Create profile with pending status
        Profile::create([
            'user_id' => $user->id,
            'first_name' => $validated['name'],
            'role' => 'user',
            'status' => 'pending',
        ]);

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'message' => 'Đăng ký thành công. Tài khoản đang chờ phê duyệt.',
            'user' => $user->load('profile'),
            'token' => $token,
        ], 201);
    }

    /**
     * Login user.
     */
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (!Auth::attempt($validated)) {
            return response()->json([
                'message' => 'Email hoặc mật khẩu không chính xác.',
            ], 401);
        }

        $user = User::where('email', $validated['email'])->first();
        
        // Check if user is banned
        if ($user->profile?->status === 'banned') {
            return response()->json([
                'message' => 'Tài khoản của bạn đã bị khóa.',
            ], 403);
        }

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'message' => 'Đăng nhập thành công.',
            'user' => $user->load('profile', 'subscription.plan'),
            'token' => $token,
        ]);
    }

    /**
     * Get current user profile.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load('profile', 'subscription.plan');

        return response()->json([
            'user' => $user,
            'subscription' => $user->subscription ? [
                'plan_name' => $user->subscription->plan?->name,
                'videos_used' => $user->subscription->current_period_videos_used,
                'video_limit' => $user->subscription->plan?->monthly_video_limit,
                'voices_used' => $user->subscription->current_period_voices_used,
                'voice_limit' => $user->subscription->plan?->monthly_voice_limit,
                'price' => $user->subscription->plan?->price,
            ] : null,
        ]);
    }

    /**
     * Logout user.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Đăng xuất thành công.',
        ]);
    }

    /**
     * Forgot password.
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'string', 'email'],
        ]);

        // TODO: Implement password reset logic

        return response()->json([
            'message' => 'Nếu email tồn tại, chúng tôi sẽ gửi link đặt lại mật khẩu.',
        ]);
    }
}
