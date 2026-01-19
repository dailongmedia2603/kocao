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
        Schema::create('dreamface_tasks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('koc_id')->nullable()->constrained()->nullOnDelete();
            $table->uuid('idea_id')->nullable();
            $table->string('original_video_url');
            $table->string('original_audio_url');
            $table->string('status')->default('pending'); // pending, processing, completed, failed
            $table->string('animate_id')->nullable();
            $table->string('thumbnail_url')->nullable();
            $table->string('result_video_url')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index('koc_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('dreamface_tasks');
    }
};
