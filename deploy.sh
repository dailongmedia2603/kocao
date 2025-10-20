# Kocao API - Simple Deploy Script
echo "Starting Kocao API deployment..."

# Update system
echo "Updating system packages..."
apt update && apt upgrade -y

# Install Python and pip
echo "Installing Python..."
apt install -y python3 python3-pip python3-venv

# Install Node.js for PM2
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install PM2
echo "⚡ Installing PM2..."
npm install -g pm2

# Clone repository (if not exists)
if [ ! -d "kocao" ]; then
    echo "Cloning repository..."
    git clone https://github.com/your-username/kocao.git
fi

cd kocao

# Create virtual environment
echo "Setting up virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Create logs directory
mkdir -p logs

# Start with PM2
echo "Starting application with PM2..."
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup

echo "Deployment completed!"
echo "Check status: pm2 status"
echo "View logs: pm2 logs kocao"
echo "API running at: http://localhost:8000"
