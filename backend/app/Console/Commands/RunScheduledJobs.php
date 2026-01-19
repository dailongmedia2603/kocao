<?php

namespace App\Console\Commands;

use App\Jobs\SyncVoiceTasks;
use App\Jobs\SyncDreamfaceTasks;
use App\Jobs\AutoIdeaToVoice;
use App\Jobs\AutoVoiceToVideo;
use App\Jobs\ScanKocStats;
use Illuminate\Console\Command;

class RunScheduledJobs extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'app:run-jobs 
                            {--sync-voice : Run SyncVoiceTasks}
                            {--sync-dreamface : Run SyncDreamfaceTasks}
                            {--auto-voice : Run AutoIdeaToVoice}
                            {--auto-video : Run AutoVoiceToVideo}
                            {--scan-kocs : Run ScanKocStats}
                            {--all : Run all jobs}';

    /**
     * The console command description.
     */
    protected $description = 'Manually run scheduled jobs';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $runAll = $this->option('all');

        if ($runAll || $this->option('sync-voice')) {
            $this->info('Running SyncVoiceTasks...');
            dispatch_sync(new SyncVoiceTasks());
            $this->info('✓ SyncVoiceTasks completed');
        }

        if ($runAll || $this->option('sync-dreamface')) {
            $this->info('Running SyncDreamfaceTasks...');
            dispatch_sync(new SyncDreamfaceTasks());
            $this->info('✓ SyncDreamfaceTasks completed');
        }

        if ($runAll || $this->option('auto-voice')) {
            $this->info('Running AutoIdeaToVoice...');
            dispatch_sync(new AutoIdeaToVoice());
            $this->info('✓ AutoIdeaToVoice completed');
        }

        if ($runAll || $this->option('auto-video')) {
            $this->info('Running AutoVoiceToVideo...');
            dispatch_sync(new AutoVoiceToVideo());
            $this->info('✓ AutoVoiceToVideo completed');
        }

        if ($runAll || $this->option('scan-kocs')) {
            $this->info('Running ScanKocStats...');
            dispatch_sync(new ScanKocStats());
            $this->info('✓ ScanKocStats completed');
        }

        $this->newLine();
        $this->info('All requested jobs completed!');

        return Command::SUCCESS;
    }
}
