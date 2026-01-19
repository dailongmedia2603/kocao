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
        Schema::create('cloned_voices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('voice_id')->unique();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->string('voice_name');
            $table->string('sample_audio')->nullable();
            $table->string('cover_url')->nullable();
            $table->timestamps();

            $table->index('user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cloned_voices');
    }
};
