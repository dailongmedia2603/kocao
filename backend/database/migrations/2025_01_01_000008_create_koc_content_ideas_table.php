<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('koc_content_ideas', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('koc_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->text('idea_content');
            $table->text('new_content')->nullable();
            $table->string('status')->default('Chưa sử dụng');
            $table->string('voice_task_id')->nullable();
            $table->string('voice_audio_url')->nullable();
            $table->uuid('dreamface_task_id')->nullable();
            $table->uuid('final_video_file_id')->nullable();
            $table->text('ai_prompt_log')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();

            $table->index(['koc_id', 'status']);
            $table->index('user_id');
            
            $table->foreign('voice_task_id')->references('id')->on('voice_tasks')->nullOnDelete();
            $table->foreign('dreamface_task_id')->references('id')->on('dreamface_tasks')->nullOnDelete();
            $table->foreign('final_video_file_id')->references('id')->on('koc_files')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('koc_content_ideas');
    }
};
