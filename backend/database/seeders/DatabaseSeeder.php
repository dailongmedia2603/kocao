<?php

namespace Database\Seeders;

use App\Models\AiPromptTemplate;
use App\Models\Profile;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Models\UserSubscription;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Create subscription plans
        $this->createSubscriptionPlans();

        // Create admin user
        $this->createAdminUser();

        // Create default AI prompt template
        $this->createDefaultAiTemplate();

        $this->command->info('Database seeded successfully!');
    }

    protected function createSubscriptionPlans(): void
    {
        // Free plan
        SubscriptionPlan::firstOrCreate(
            ['name' => 'Free'],
            [
                'description' => 'Gói miễn phí dành cho người dùng mới',
                'price' => 0,
                'monthly_video_limit' => 5,
                'monthly_voice_limit' => 10,
                'is_active' => true,
            ]
        );

        // Basic plan
        SubscriptionPlan::firstOrCreate(
            ['name' => 'Basic'],
            [
                'description' => 'Gói cơ bản cho người dùng cá nhân',
                'price' => 199000,
                'monthly_video_limit' => 50,
                'monthly_voice_limit' => 100,
                'is_active' => true,
            ]
        );

        // Pro plan
        SubscriptionPlan::firstOrCreate(
            ['name' => 'Pro'],
            [
                'description' => 'Gói chuyên nghiệp cho doanh nghiệp',
                'price' => 499000,
                'monthly_video_limit' => 200,
                'monthly_voice_limit' => 500,
                'is_active' => true,
            ]
        );

        // Unlimited plan
        SubscriptionPlan::firstOrCreate(
            ['name' => 'Unlimited'],
            [
                'description' => 'Gói không giới hạn',
                'price' => 999000,
                'monthly_video_limit' => 9999,
                'monthly_voice_limit' => 9999,
                'is_active' => true,
            ]
        );

        $this->command->info('Created subscription plans');
    }

    protected function createAdminUser(): void
    {
        // Check if admin exists
        $adminEmail = 'admin@kocao.vn';
        
        if (User::where('email', $adminEmail)->exists()) {
            $this->command->info('Admin user already exists');
            return;
        }

        $admin = User::create([
            'id' => Str::uuid()->toString(),
            'name' => 'Administrator',
            'email' => $adminEmail,
            'password' => Hash::make('admin123'),
            'email_verified_at' => now(),
        ]);

        Profile::create([
            'user_id' => $admin->id,
            'first_name' => 'Admin',
            'last_name' => 'KOC',
            'role' => 'admin',
            'status' => 'active',
        ]);

        // Assign unlimited plan to admin
        $unlimitedPlan = SubscriptionPlan::where('name', 'Unlimited')->first();
        if ($unlimitedPlan) {
            UserSubscription::create([
                'user_id' => $admin->id,
                'plan_id' => $unlimitedPlan->id,
                'status' => 'active',
                'current_period_start' => now(),
                'current_period_end' => now()->addYear(),
                'current_period_videos_used' => 0,
                'current_period_voices_used' => 0,
            ]);
        }

        $this->command->info("Created admin user: {$adminEmail} / admin123");
    }

    protected function createDefaultAiTemplate(): void
    {
        // Check if default template exists
        if (AiPromptTemplate::whereNull('user_id')->where('is_public', true)->exists()) {
            $this->command->info('Default AI template already exists');
            return;
        }

        AiPromptTemplate::create([
            'user_id' => null,
            'name' => 'Template Mặc Định',
            'general_prompt' => 'Tạo một kịch bản video ngắn, hấp dẫn và dễ hiểu cho KOC.',
            'tone_of_voice' => 'Thân thiện, tự nhiên, chuyên nghiệp',
            'writing_style' => 'Ngắn gọn, súc tích, dễ đọc',
            'writing_method' => 'Storytelling, kết hợp cảm xúc và thông tin',
            'ai_role' => 'Content Creator chuyên nghiệp với kinh nghiệm tạo video viral',
            'mandatory_requirements' => 'Phải có hook mạnh ở đầu, call-to-action ở cuối',
            'example_dialogue' => 'Xin chào các bạn! Hôm nay mình sẽ chia sẻ với các bạn về...',
            'word_count' => 300,
            'is_public' => true,
            'is_default' => true,
        ]);

        $this->command->info('Created default AI template');
    }
}
