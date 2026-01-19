<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Cloudflare R2 Storage
    |--------------------------------------------------------------------------
    */
    'r2' => [
        'account_id' => env('R2_ACCOUNT_ID'),
        'access_key_id' => env('R2_ACCESS_KEY_ID'),
        'secret_access_key' => env('R2_SECRET_ACCESS_KEY'),
        'bucket' => env('R2_BUCKET_NAME'),
        'public_url' => env('R2_PUBLIC_URL'),
        'endpoint' => env('R2_ACCOUNT_ID') ? 'https://' . env('R2_ACCOUNT_ID') . '.r2.cloudflarestorage.com' : null,
    ],

    /*
    |--------------------------------------------------------------------------
    | External API Services
    |--------------------------------------------------------------------------
    */
    'tiktok' => [
        'api_url' => env('TIKTOK_API_URL', 'https://api.akng.io.vn'),
    ],

    'dreamface' => [
        'api_url' => env('DREAMFACE_API_URL', 'https://dapi.qcv.vn'),
    ],

    'voice' => [
        'api_url' => env('VOICE_API_URL', 'https://gateway.vivoo.work'),
    ],

];
