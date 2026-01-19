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
        Schema::create('kling_video_jobs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('koc_id')->nullable()->constrained('kocs')->nullOnDelete();
            $table->string('job_id')->unique(); // ID from Kling API
            $table->enum('status', ['pending', 'processing', 'completed', 'failed'])->default('pending');
            $table->integer('progress')->default(0);
            $table->text('prompt')->nullable();
            $table->string('quality_mode')->default('Standard');
            $table->string('result_video_url')->nullable();
            $table->text('error_message')->nullable();
            $table->json('logs')->nullable();
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
        Schema::dropIfExists('kling_video_jobs');
    }
};
