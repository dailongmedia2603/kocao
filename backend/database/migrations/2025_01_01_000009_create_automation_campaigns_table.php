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
        Schema::create('automation_campaigns', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('koc_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->enum('status', ['active', 'paused'])->default('paused');
            $table->string('cloned_voice_id')->nullable();
            $table->string('cloned_voice_name')->nullable();
            $table->uuid('ai_template_id')->nullable();
            $table->string('model')->nullable();
            $table->integer('max_words')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index('koc_id');

            $table->foreign('ai_template_id')->references('id')->on('ai_prompt_templates')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('automation_campaigns');
    }
};
