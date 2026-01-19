/**
 * Laravel API Client for KOC AI Application
 * Replaces Supabase integration with custom Laravel backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8888/api';

// Types
export interface User {
    id: string;
    name: string;
    email: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface Profile {
    id: string;
    user_id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    role: 'user' | 'admin';
    status: 'pending' | 'active' | 'banned';
}

export interface SubscriptionInfo {
    plan_name: string;
    videos_used: number;
    video_limit: number;
    voices_used: number;
    voice_limit: number;
    price: number;
}

export interface AuthResponse {
    user: User & { profile: Profile };
    token: string;
    message: string;
    subscription?: SubscriptionInfo;
}

export interface ApiError {
    message: string;
    errors?: Record<string, string[]>;
}

// Token management
let authToken: string | null = localStorage.getItem('auth_token');

export const setAuthToken = (token: string | null) => {
    authToken = token;
    if (token) {
        localStorage.setItem('auth_token', token);
    } else {
        localStorage.removeItem('auth_token');
    }
};

export const getAuthToken = () => authToken;



// Base fetch wrapper
const apiFetch = async <T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.headers as Record<string, string>),
    };

    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    // Handle 401 - redirect to login
    if (response.status === 401) {
        setAuthToken(null);
        window.location.href = '/login';
        throw new Error('Phiên đăng nhập đã hết hạn');
    }

    const data = await response.json();

    if (!response.ok) {
        const errorMessage = data.message || data.error || 'Đã có lỗi xảy ra';
        throw new Error(errorMessage);
    }

    return data as T;
};

// File upload helper
const apiUpload = async <T>(
    endpoint: string,
    formData: FormData
): Promise<T> => {
    const headers: Record<string, string> = {
        'Accept': 'application/json',
    };

    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
    });

    if (response.status === 401) {
        setAuthToken(null);
        window.location.href = '/login';
        throw new Error('Phiên đăng nhập đã hết hạn');
    }

    const data = await response.json();

    if (!response.ok) {
        const errorMessage = data.message || data.error || 'Đã có lỗi xảy ra';
        throw new Error(errorMessage);
    }

    return data as T;
};


// ===========================================
// AUTH API
// ===========================================
export const authApi = {
    register: (data: { name: string; email: string; password: string; password_confirmation: string }) =>
        apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

    login: (data: { email: string; password: string }) =>
        apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

    logout: () =>
        apiFetch<{ message: string }>('/auth/logout', { method: 'POST' }),

    me: () =>
        apiFetch<{ user: User & { profile: Profile; subscription?: { plan: any } }; subscription: SubscriptionInfo | null }>('/auth/me'),

    forgotPassword: (email: string) =>
        apiFetch<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

    resetPassword: (data: { token: string; email: string; password: string; password_confirmation: string }) =>
        apiFetch<{ message: string; status: string }>('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) }),
};

// ===========================================
// KOC API
// ===========================================
export interface Koc {
    id: string;
    user_id: string;
    name: string;
    field: string | null;
    avatar_url: string | null;
    channel_url: string | null;
    folder_path: string | null;
    follower_count: number | null;
    like_count: number | null;
    video_count: number | null;
    channel_nickname: string | null;
    default_prompt_template_id: string | null;
    default_cloned_voice_id: string | null;
    created_at: string;
    updated_at: string;
    files_count?: number;
    ideas_count?: number;
}

export const kocApi = {
    list: () => apiFetch<Koc[]>('/kocs'),

    listWithStats: () => apiFetch<Koc[]>('/kocs-with-stats'),

    get: (id: string) => apiFetch<Koc>(`/kocs/${id}`),

    create: (data: { name: string; field?: string; avatar_url?: string; channel_url?: string }) =>
        apiFetch<Koc>('/kocs', { method: 'POST', body: JSON.stringify(data) }),

    update: (id: string, data: Partial<Koc>) =>
        apiFetch<Koc>(`/kocs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    delete: (id: string) =>
        apiFetch<{ message: string }>(`/kocs/${id}`, { method: 'DELETE' }),

    scanStats: (id: string) =>
        apiFetch<{ success: boolean; message: string; koc: Koc }>(`/kocs/${id}/scan-stats`, { method: 'POST' }),
};

// ===========================================
// KOC FILES API
// ===========================================
export interface KocFile {
    id: string;
    koc_id: string;
    user_id: string;
    r2_key: string;
    display_name: string;
    url: string | null;
    thumbnail_url: string | null;
    public_url: string;
    created_at: string;
}

export const kocFilesApi = {
    list: (kocId: string) => apiFetch<KocFile[]>(`/kocs/${kocId}/files`),

    upload: (kocId: string, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return apiUpload<{ success: boolean; file: KocFile }>(`/kocs/${kocId}/files/upload`, formData);
    },

    delete: (fileId: string) =>
        apiFetch<{ success: boolean }>(`/koc-files/${fileId}`, { method: 'DELETE' }),

    deleteBatch: (fileIds: string[]) =>
        apiFetch<{ success: boolean; deleted_count: number }>('/koc-files/batch', {
            method: 'DELETE',
            body: JSON.stringify({ file_ids: fileIds })
        }),

    getDownloadUrl: (fileId: string) =>
        apiFetch<{ url: string; expires_in?: number }>(`/koc-files/${fileId}/download-url`),
};

// ===========================================
// IDEAS API
// ===========================================
export interface ContentIdea {
    id: string;
    koc_id: string;
    user_id: string;
    idea_content: string;
    new_content: string | null;
    status: string;
    voice_task_id: string | null;
    voice_audio_url: string | null;
    dreamface_task_id: string | null;
    final_video_file_id: string | null;
    error_message: string | null;
    created_at: string;
    updated_at: string;
    voice_task?: any;
    dreamface_task?: any;
    final_video_file?: KocFile;
}

export const ideasApi = {
    list: (kocId: string) => apiFetch<ContentIdea[]>(`/kocs/${kocId}/ideas`),

    create: (data: { koc_id: string; idea_content: string; new_content?: string }) =>
        apiFetch<ContentIdea>(`/kocs/${data.koc_id}/ideas`, {
            method: 'POST',
            body: JSON.stringify({
                idea_content: data.idea_content,
                new_content: data.new_content
            })
        }),

    update: (ideaId: string, data: Partial<ContentIdea>) =>
        apiFetch<ContentIdea>(`/ideas/${ideaId}`, { method: 'PUT', body: JSON.stringify(data) }),

    delete: (ideaId: string) =>
        apiFetch<{ success: boolean }>(`/ideas/${ideaId}`, { method: 'DELETE' }),

    generateContent: (ideaId: string) =>
        apiFetch<{ success: boolean; message: string; idea: ContentIdea }>(`/ideas/${ideaId}/generate-content`, { method: 'POST' }),

    createVoice: (ideaId: string) =>
        apiFetch<{ success: boolean; message: string; idea: ContentIdea; task_id?: string }>(`/ideas/${ideaId}/create-voice`, { method: 'POST' }),

    createVideo: (ideaId: string) =>
        apiFetch<{ success: boolean; message: string; idea: ContentIdea; task?: any }>(`/ideas/${ideaId}/create-video`, { method: 'POST' }),
};

// ===========================================
// VOICE API
// ===========================================
export interface VoiceTask {
    id: string;
    user_id: string;
    voice_name: string | null;
    status: string;
    audio_url: string | null;
    srt_url: string | null;
    error_message: string | null;
    created_at: string;
}

export interface ClonedVoice {
    voice_id: string;
    user_id: string;
    voice_name: string;
    sample_audio: string | null;
    cover_url: string | null;
    created_at: string;
}

export const voiceApi = {
    tasks: () => apiFetch<VoiceTask[]>('/voice/tasks'),

    textToSpeech: (data: { text: string; voice_name: string; voice_setting?: any; cloned_voice_name?: string }) =>
        apiFetch<{ success: boolean; task_id?: string }>('/voice/text-to-speech', { method: 'POST', body: JSON.stringify(data) }),

    clonedVoices: () => apiFetch<ClonedVoice[]>('/voice/cloned-voices'),

    cloneVoice: (file: File, voiceName: string, previewText?: string) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('voice_name', voiceName);
        if (previewText) formData.append('preview_text', previewText);
        return apiUpload<{ success: boolean; clone_voice_id?: string }>('/voice/clone', formData);
    },

    deleteClonedVoice: (voiceId: string) =>
        apiFetch<{ success: boolean }>(`/voice/cloned-voices/${voiceId}`, { method: 'DELETE' }),

    credits: () => apiFetch<{ credits: number }>('/voice/credits'),

    proxy: (data: { path: string; method: string; body?: any }) =>
        apiFetch<any>('/voice/proxy', { method: 'POST', body: JSON.stringify(data) }),

    logs: () => apiFetch<any[]>('/voice/logs'),
};

// ===========================================
// DREAMFACE API
// ===========================================
export interface DreamfaceTask {
    id: string;
    user_id: string;
    koc_id: string;
    idea_id: string | null;
    original_video_url: string;
    original_audio_url: string;
    animate_id: string | null;
    result_video_url: string | null;
    status: string;
    error_message: string | null;
    created_at: string;
}

export const dreamfaceApi = {
    tasks: () => apiFetch<DreamfaceTask[]>('/dreamface/tasks'),

    create: (data: { koc_id: string; video_url: string; audio_url: string | null; idea_id?: string }) =>
        apiFetch<{ success: boolean; task: DreamfaceTask }>('/dreamface/create', { method: 'POST', body: JSON.stringify(data) }),

    createWithFile: (data: { koc_id: string; video_url: string; audio_file: File; idea_id?: string }) => {
        const formData = new FormData();
        formData.append('koc_id', data.koc_id);
        formData.append('video_url', data.video_url);
        formData.append('audio_file', data.audio_file);
        if (data.idea_id) formData.append('idea_id', data.idea_id);
        return apiUpload<{ success: boolean; task: DreamfaceTask }>('/dreamface/create', formData);
    },

    delete: (taskId: string) =>
        apiFetch<{ success: boolean }>(`/dreamface/tasks/${taskId}`, { method: 'DELETE' }),

    getDownloadUrl: (taskId: string) =>
        apiFetch<{ url: string }>(`/dreamface/tasks/${taskId}/download-url`),

    archive: (taskId: string) =>
        apiFetch<{ success: boolean; message: string }>(`/dreamface/tasks/${taskId}/archive`, { method: 'POST' }),

    logs: () => apiFetch<any[]>('/dreamface/logs'),
};

// ===========================================
// AI API
// ===========================================
export const aiApi = {
    generateText: (prompt: string, options?: { provider?: string; model?: string }) =>
        apiFetch<{ text: string }>('/ai/generate-text', {
            method: 'POST',
            body: JSON.stringify({ prompt, ...options })
        }),
};

// ===========================================
// AUTOMATION API
// ===========================================
export interface AutomationCampaign {
    id: string;
    user_id: string;
    koc_id: string;
    name: string;
    description: string | null;
    status: 'active' | 'paused';
    cloned_voice_id: string | null;
    cloned_voice_name: string | null;
    ai_template_id: string | null;
    model: string | null;
    max_words: number | null;
    created_at: string;
    koc?: Koc;
    ai_template?: any;
}

export const automationApi = {
    list: () => apiFetch<AutomationCampaign[]>('/automation/campaigns'),

    get: (id: string) => apiFetch<AutomationCampaign>(`/automation/campaigns/${id}`),

    create: (data: Partial<AutomationCampaign>) =>
        apiFetch<AutomationCampaign>('/automation/campaigns', { method: 'POST', body: JSON.stringify(data) }),

    update: (id: string, data: Partial<AutomationCampaign>) =>
        apiFetch<AutomationCampaign>(`/automation/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    delete: (id: string) =>
        apiFetch<{ success: boolean }>(`/automation/campaigns/${id}`, { method: 'DELETE' }),

    toggle: (id: string) =>
        apiFetch<{ success: boolean; status: string }>(`/automation/campaigns/${id}/toggle`, { method: 'POST' }),

    activityLog: (id: string) =>
        apiFetch<ContentIdea[]>(`/automation/campaigns/${id}/activity-log`),
};

// ===========================================
// AI TEMPLATES API
// ===========================================
export interface AiTemplate {
    id: string;
    user_id: string | null;
    name: string;
    general_prompt: string | null;
    tone_of_voice: string | null;
    writing_style: string | null;
    writing_method: string | null;
    ai_role: string | null;
    mandatory_requirements: string | null;
    example_dialogue: string | null;
    word_count: number | null;
    is_public: boolean;
    is_default: boolean;
    created_at: string;
}

export const aiTemplatesApi = {
    list: () => apiFetch<AiTemplate[]>('/ai-templates'),

    get: (id: string) => apiFetch<AiTemplate>(`/ai-templates/${id}`),

    create: (data: Partial<AiTemplate>) =>
        apiFetch<AiTemplate>('/ai-templates', { method: 'POST', body: JSON.stringify(data) }),

    update: (id: string, data: Partial<AiTemplate>) =>
        apiFetch<AiTemplate>(`/ai-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    delete: (id: string) =>
        apiFetch<{ success: boolean }>(`/ai-templates/${id}`, { method: 'DELETE' }),

    setDefault: (id: string) =>
        apiFetch<{ success: boolean; template: AiTemplate }>(`/ai-templates/${id}/set-default`, { method: 'POST' }),
};

// ===========================================
// SUBSCRIPTION API
// ===========================================
export interface SubscriptionPlan {
    id: string;
    name: string;
    description: string | null;
    price: number;
    monthly_video_limit: number;
    monthly_voice_limit: number;
    is_active: boolean;
}

export const subscriptionApi = {
    current: () => apiFetch<{ subscription: SubscriptionInfo | null }>('/subscription/current'),

    plans: () => apiFetch<SubscriptionPlan[]>('/subscription/plans'),
};

// ===========================================
// SETTINGS API
// ===========================================
export const settingsApi = {
    // TikTok
    getTiktok: () => apiFetch<{ has_token: boolean; check_url?: string }>('/settings/tiktok'),
    saveTiktok: (accessToken: string, checkUrl?: string) =>
        apiFetch<{ success: boolean }>('/settings/tiktok', { method: 'POST', body: JSON.stringify({ access_token: accessToken, check_url: checkUrl }) }),
    deleteTiktok: () => apiFetch<{ success: boolean }>('/settings/tiktok', { method: 'DELETE' }),
    checkTiktok: () => apiFetch<{ valid: boolean }>('/settings/tiktok/check', { method: 'POST' }),

    // Facebook
    getFacebook: () => apiFetch<{ has_token: boolean }>('/settings/facebook'),
    saveFacebook: (accessToken: string, checkUrl?: string) =>
        apiFetch<{ success: boolean }>('/settings/facebook', { method: 'POST', body: JSON.stringify({ access_token: accessToken, check_url: checkUrl }) }),
    deleteFacebook: () => apiFetch<{ success: boolean }>('/settings/facebook', { method: 'DELETE' }),

    // Dreamface
    getDreamface: () => apiFetch<{ has_credentials: boolean }>('/settings/dreamface'),
    saveDreamface: (data: { account_id: string; user_id_dreamface: string; token_id: string; client_id: string }) =>
        apiFetch<{ success: boolean }>('/settings/dreamface', { method: 'POST', body: JSON.stringify(data) }),
    deleteDreamface: () => apiFetch<{ success: boolean }>('/settings/dreamface', { method: 'DELETE' }),

    // Voice API
    getVoiceApi: () => apiFetch<{ has_key: boolean }>('/settings/voice-api'),
    saveVoiceApi: (apiKey: string) =>
        apiFetch<{ success: boolean }>('/settings/voice-api', { method: 'POST', body: JSON.stringify({ api_key: apiKey }) }),
    deleteVoiceApi: () => apiFetch<{ success: boolean }>('/settings/voice-api', { method: 'DELETE' }),
    checkVoiceApi: () => apiFetch<{ valid: boolean }>('/settings/voice-api/check', { method: 'POST' }),





    // Vertex AI
    getVertexAi: () => apiFetch<{ has_credentials: boolean }>('/settings/vertex-ai'),
    saveVertexAi: (credentials: object) =>
        apiFetch<{ success: boolean }>('/settings/vertex-ai', { method: 'POST', body: JSON.stringify({ credentials }) }),
    deleteVertexAi: () => apiFetch<{ success: boolean }>('/settings/vertex-ai', { method: 'DELETE' }),

    // Gemini API (formerly Troll LLM)
    getTrollLlm: () => apiFetch<{ has_key: boolean; base_url?: string; model?: string }>('/settings/troll-llm'),
    saveTrollLlm: (apiKey: string, baseUrl?: string, model?: string) =>
        apiFetch<{ success: boolean }>('/settings/troll-llm', { method: 'POST', body: JSON.stringify({ api_key: apiKey, base_url: baseUrl, model }) }),
    deleteTrollLlm: () => apiFetch<{ success: boolean }>('/settings/troll-llm', { method: 'DELETE' }),
    checkTrollLlm: () => apiFetch<{ valid: boolean; message?: string }>('/settings/troll-llm/check', { method: 'POST' }),

    // Kling API
    getKlingApi: () => apiFetch<{ has_config: boolean; api_url?: string; cookie?: string }>('/settings/kling-api'),
    saveKlingApi: (apiUrl: string, cookie: string) =>
        apiFetch<{ success: boolean }>('/settings/kling-api', { method: 'POST', body: JSON.stringify({ api_url: apiUrl, cookie }) }),
    deleteKlingApi: () => apiFetch<{ success: boolean }>('/settings/kling-api', { method: 'DELETE' }),
    checkKlingApi: () => apiFetch<{ valid: boolean; message?: string; user?: any }>('/settings/kling-api/check', { method: 'POST' }),

    // Image Gen API
    getImageGenApi: () => apiFetch<{ has_key: boolean }>('/settings/image-gen-api'),
    saveImageGenApi: (apiKey: string) =>
        apiFetch<{ success: boolean }>('/settings/image-gen-api', { method: 'POST', body: JSON.stringify({ api_key: apiKey }) }),
    deleteImageGenApi: () => apiFetch<{ success: boolean }>('/settings/image-gen-api', { method: 'DELETE' }),
    checkImageGenApi: () => apiFetch<{ valid: boolean; message?: string }>('/settings/image-gen-api/check', { method: 'POST' }),

    // Cloudflare R2
    getR2: () => apiFetch<{ has_config: boolean; endpoint?: string; bucket?: string; public_url?: string }>('/settings/r2'),
    saveR2: (data: { endpoint: string; access_key_id: string; secret_access_key: string; bucket: string; public_url?: string }) =>
        apiFetch<{ success: boolean }>('/settings/r2', { method: 'POST', body: JSON.stringify(data) }),
    deleteR2: () => apiFetch<{ success: boolean }>('/settings/r2', { method: 'DELETE' }),
    checkR2: () => apiFetch<{ valid: boolean; message?: string }>('/settings/r2/check', { method: 'POST' }),
};

// ===========================================
// KLING VIDEO GENERATION API
// ===========================================
export interface KlingJob {
    id: string;
    job_id: string;
    koc_id: string | null;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    prompt: string | null;
    quality_mode: string;
    result_video_url: string | null;
    error_message: string | null;
    logs: string[];
    created_at: string;
    updated_at: string;
}

export const klingApi = {
    generate: (formData: FormData) =>
        apiUpload<{ status: string; id: string; jobId: string; message: string; queuePosition: number }>('/kling/generate', formData),

    saveJob: (data: { job_id: string; koc_id?: string; prompt?: string; quality_mode?: string }) =>
        apiFetch<{ status: string; id: string; message: string }>('/kling/jobs', { method: 'POST', body: JSON.stringify(data) }),

    listJobs: (kocId?: string) =>
        apiFetch<KlingJob[]>(`/kling/jobs${kocId ? `?koc_id=${kocId}` : ''}`),

    status: (jobId: string) =>
        apiFetch<{ status: string; data: KlingJob }>(`/kling/status/${jobId}`),

    deleteJob: (jobId: string) =>
        apiFetch<{ status: string }>(`/kling/jobs/${jobId}`, { method: 'DELETE' }),
};

// ===========================================
// IMAGE GENERATION API
// ===========================================
export interface ImageGenerationTask {
    id: string;
    user_id: string;
    koc_id: string | null;
    prompt: string | null;
    aspect_ratio: string;
    image_size: string;
    status: string;
    result_image_url: string | null;
    result_text: string | null;
    error_message: string | null;
    created_at: string;
}

export const imageGenerationApi = {
    generate: (data: { prompt: string; images_base64?: string[]; koc_id?: string; aspect_ratio?: string; image_size?: string }) =>
        apiFetch<{ success: boolean; task: ImageGenerationTask }>('/image-generation/generate', { method: 'POST', body: JSON.stringify(data) }),

    tasks: (kocId?: string) =>
        apiFetch<ImageGenerationTask[]>(`/image-generation/tasks${kocId ? `?koc_id=${kocId}` : ''}`),

    delete: (taskId: string) =>
        apiFetch<{ success: boolean }>(`/image-generation/tasks/${taskId}`, { method: 'DELETE' }),

    getDownloadUrl: (taskId: string) =>
        `${API_BASE_URL}/image-generation/tasks/${taskId}/download`,
};

// ===========================================
// KOC AVATARS API
// ===========================================
export interface KocAvatar {
    id: string;
    user_id: string;
    koc_id: string;
    image_url: string | null;
    prompt: string | null;
    source: 'generated' | 'uploaded';
    status: string;
    is_active: boolean;
    error_message: string | null;
    created_at: string;
    updated_at: string;
}

export const kocAvatarsApi = {
    list: (kocId: string) => apiFetch<KocAvatar[]>(`/kocs/${kocId}/avatars`),

    generate: (kocId: string, data: { prompt: string; images_base64?: string[] }) =>
        apiFetch<{ success: boolean; avatar: KocAvatar }>(`/kocs/${kocId}/avatars/generate`, { method: 'POST', body: JSON.stringify(data) }),

    upload: (kocId: string, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return apiUpload<{ success: boolean; avatar: KocAvatar }>(`/kocs/${kocId}/avatars/upload`, formData);
    },

    setActive: (kocId: string, avatarId: string) =>
        apiFetch<{ success: boolean; avatar: KocAvatar }>(`/kocs/${kocId}/avatars/${avatarId}/set-active`, { method: 'POST' }),

    delete: (kocId: string, avatarId: string) =>
        apiFetch<{ success: boolean }>(`/kocs/${kocId}/avatars/${avatarId}`, { method: 'DELETE' }),

    getDownloadUrl: (kocId: string, avatarId: string) =>
        `${API_BASE_URL}/kocs/${kocId}/avatars/${avatarId}/download`,
};

// ===========================================
// TRANSCRIPTION API
// ===========================================
export interface TranscriptionTask {
    id: string;
    user_id: string;
    video_url: string;
    video_name: string;
    status: string;
    result_text: string | null;
    created_at: string;
}

export const transcriptionApi = {
    tasks: () => apiFetch<TranscriptionTask[]>('/transcription/tasks'),

    start: (videoUrl: string, videoName: string) =>
        apiFetch<TranscriptionTask>('/transcription/start', { method: 'POST', body: JSON.stringify({ video_url: videoUrl, video_name: videoName }) }),

    channelMetadata: (url: string) =>
        apiFetch<any>('/transcription/channel-metadata', { method: 'POST', body: JSON.stringify({ url }) }),

    downloadChannel: (url: string, limit?: number) =>
        apiFetch<any>('/transcription/download-channel', { method: 'POST', body: JSON.stringify({ url, limit }) }),

    serverFiles: () =>
        apiFetch<{ videos: any[] }>('/transcription/server-files'),

    logs: (taskId: string) =>
        apiFetch<{ api_response_log: any }>(`/transcription/tasks/${taskId}/logs`),
};

// ===========================================
// CONTENT PLAN API
// ===========================================
export interface ContentPlan {
    id: string;
    user_id: string;
    name: string;
    content: any;
    status: string;
    created_at: string;
}

export const contentPlanApi = {
    list: () => apiFetch<ContentPlan[]>('/content-plans'),

    get: (id: string) => apiFetch<ContentPlan>(`/content-plans/${id}`),

    create: (data: { name: string; content?: any }) =>
        apiFetch<ContentPlan>('/content-plans', { method: 'POST', body: JSON.stringify(data) }),

    update: (id: string, data: Partial<ContentPlan>) =>
        apiFetch<ContentPlan>(`/content-plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    delete: (id: string) =>
        apiFetch<{ success: boolean }>(`/content-plans/${id}`, { method: 'DELETE' }),

    generate: (topic: string, duration?: string, kocId?: string) =>
        apiFetch<{ success: boolean; message: string }>('/content-plans/generate', { method: 'POST', body: JSON.stringify({ topic, duration, koc_id: kocId }) }),

    generateMoreIdeas: (planId: string) =>
        apiFetch<{ success: boolean; message: string }>(`/content-plans/${planId}/generate-more-ideas`, { method: 'POST' }),
};

// ===========================================
// VIDEO CRISPTS API
// ===========================================
export interface VideoScript {
    id: string;
    video_id: string | null;
    koc_id: string;
    script_content: string | null;
    created_at: string;
    name: string;
    ai_prompt: string | null;
    news_posts: any;
}

export const videoScriptsApi = {
    list: (kocId: string) => apiFetch<VideoScript[]>(`/kocs/${kocId}/scripts`),
    delete: (id: string) => apiFetch<{ success: boolean }>(`/video-scripts/${id}`, { method: 'DELETE' }),
};

// ===========================================
// ADMIN API
// ===========================================
export const adminApi = {
    users: {
        list: () => apiFetch<{ data: (User & { profile?: Profile })[] }>('/admin/users'),
        create: (data: any) => apiFetch<User & { profile?: Profile }>('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
        update: (userId: string, data: any) =>
            apiFetch<User & { profile?: Profile }>(`/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (userId: string) =>
            apiFetch<{ success: boolean }>(`/admin/users/${userId}`, { method: 'DELETE' }),
    },
    plans: {
        list: () => apiFetch<SubscriptionPlan[]>('/admin/plans'),
        create: (data: Partial<SubscriptionPlan>) =>
            apiFetch<SubscriptionPlan>('/admin/plans', { method: 'POST', body: JSON.stringify(data) }),
        update: (planId: string, data: Partial<SubscriptionPlan>) =>
            apiFetch<SubscriptionPlan>(`/admin/plans/${planId}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (planId: string) =>
            apiFetch<{ success: boolean }>(`/admin/plans/${planId}`, { method: 'DELETE' }),
    },
};

// Export default API object
export const api = {
    auth: authApi,
    kocs: kocApi,
    kocFiles: kocFilesApi,
    kocAvatars: kocAvatarsApi,
    ideas: ideasApi,
    voice: voiceApi,
    dreamface: dreamfaceApi,
    automation: automationApi,
    aiTemplates: aiTemplatesApi,
    subscription: subscriptionApi,
    settings: settingsApi,
    transcription: transcriptionApi,
    contentPlan: contentPlanApi,
    videoScripts: videoScriptsApi,
    ai: aiApi,
    kling: klingApi,
    imageGeneration: imageGenerationApi,
    admin: adminApi,
};

export default api;
