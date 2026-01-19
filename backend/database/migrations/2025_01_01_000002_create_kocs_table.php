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
        Schema::create('kocs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('field')->nullable();
            $table->string('avatar_url')->nullable();
            $table->string('folder_path')->nullable();
            $table->string('channel_url')->nullable();
            $table->bigInteger('follower_count')->nullable();
            $table->bigInteger('like_count')->nullable();
            $table->integer('video_count')->nullable();
            $table->string('channel_nickname')->nullable();
            $table->string('channel_unique_id')->nullable();
            $table->timestamp('channel_created_at')->nullable();
            $table->uuid('default_prompt_template_id')->nullable();
            $table->string('default_cloned_voice_id')->nullable();
            $table->timestamp('stats_updated_at')->nullable();
            $table->timestamps();

            $table->index('user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kocs');
    }
};
