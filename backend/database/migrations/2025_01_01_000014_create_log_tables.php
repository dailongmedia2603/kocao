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
        // Voice Clone Logs
        Schema::create('voice_clone_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('request_url')->nullable();
            $table->json('request_payload')->nullable();
            $table->json('response_body')->nullable();
            $table->integer('status_code')->nullable();
            $table->string('status_text')->nullable();
            $table->timestamps();

            $table->index('user_id');
        });

        // TTS Logs
        Schema::create('tts_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('task_id')->nullable();
            $table->json('request_payload')->nullable();
            $table->json('response_body')->nullable();
            $table->integer('status_code')->nullable();
            $table->timestamps();

            $table->index('user_id');
        });

        // Dreamface Logs
        Schema::create('dreamface_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->nullable()->constrained()->nullOnDelete();
            $table->uuid('dreamface_task_id')->nullable();
            $table->string('action')->nullable();
            $table->json('request_payload')->nullable();
            $table->json('response_body')->nullable();
            $table->integer('status_code')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();

            $table->index('user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('dreamface_logs');
        Schema::dropIfExists('tts_logs');
        Schema::dropIfExists('voice_clone_logs');
    }
};
