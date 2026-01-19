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
        Schema::create('voice_tasks', function (Blueprint $table) {
            $table->string('id')->primary(); // ID from external API
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->string('voice_name')->nullable();
            $table->string('status')->default('doing'); // doing, done, error
            $table->string('audio_url')->nullable();
            $table->string('srt_url')->nullable();
            $table->string('cloned_voice_id')->nullable();
            $table->string('cloned_voice_name')->nullable();
            $table->string('task_type')->default('minimax_tts');
            $table->decimal('credit_cost', 10, 4)->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('voice_tasks');
    }
};
