<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

/*
|--------------------------------------------------------------------------
| Console Routes
|--------------------------------------------------------------------------
|
| This file defines console commands and scheduled tasks for the application.
| The scheduler runs these jobs at specified intervals.
|
*/

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| Scheduled Tasks
|--------------------------------------------------------------------------
|
| Run the scheduler using: php artisan schedule:work (development)
| Or add to crontab: * * * * * php /path/to/artisan schedule:run >> /dev/null 2>&1
|
*/

// Sync voice task statuses every minute
Schedule::job(new \App\Jobs\SyncVoiceTasks())
    ->everyMinute()
    ->withoutOverlapping()
    ->name('sync-voice-tasks');

// Sync dreamface task statuses every minute
Schedule::job(new \App\Jobs\SyncDreamfaceTasks())
    ->everyMinute()
    ->withoutOverlapping()
    ->name('sync-dreamface-tasks');

// Auto convert ideas to voice every 5 minutes
Schedule::job(new \App\Jobs\AutoIdeaToVoice())
    ->everyFiveMinutes()
    ->withoutOverlapping()
    ->name('auto-idea-to-voice');

// Auto convert voice to video every 5 minutes
Schedule::job(new \App\Jobs\AutoVoiceToVideo())
    ->everyFiveMinutes()
    ->withoutOverlapping()
    ->name('auto-voice-to-video');

// Scan KOC TikTok stats every hour
Schedule::job(new \App\Jobs\ScanKocStats())
    ->hourly()
    ->withoutOverlapping()
    ->name('scan-koc-stats');

// Monthly subscription credit reset (1st of each month at 00:00)
Schedule::call(function () {
    $count = \App\Services\SubscriptionService::resetMonthlyCredits();
    \Log::info("Monthly credits reset for {$count} subscriptions");
})->monthlyOn(1, '00:00')
    ->name('reset-monthly-credits');

