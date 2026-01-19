<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KocFile extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'koc_id',
        'user_id',
        'r2_key',
        'display_name',
        'url',
        'thumbnail_url',
        'last_used_at',
    ];

    protected $casts = [
        'last_used_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the KOC that owns the file.
     */
    public function koc(): BelongsTo
    {
        return $this->belongsTo(Koc::class);
    }

    /**
     * Get the user that owns the file.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the public URL for the file.
     */
    public function getPublicUrlAttribute(): string
    {
        if ($this->url) {
            return $this->url;
        }
        
        $publicUrl = config('services.r2.public_url');
        return $publicUrl ? "{$publicUrl}/{$this->r2_key}" : '';
    }
}
