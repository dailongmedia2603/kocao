module.exports = {
    apps: [{
        name: 'kocao-api',
        script: 'main.py',
        interpreter: 'python3',
        cwd: '/root/kocao',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        env: {
            NODE_ENV: 'production',
            PORT: 8000
        },
        error_file: './logs/err.log',
        out_file: './logs/out.log',
        log_file: './logs/combined.log',
        time: true
    }]
};
