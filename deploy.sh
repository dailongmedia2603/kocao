echo "Starting Kocao API deployment..."

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Updating system packages..."
apt update && apt upgrade -y

echo "Installing Python..."
apt install -y python3 python3-pip python3-venv

echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

echo "Installing PM2..."
npm install -g pm2

echo "Setting up virtual environment..."
python3 -m venv venv
source venv/bin/activate

echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

mkdir -p logs

echo "Starting application with PM2..."
pm2 start "$SCRIPT_DIR/ecosystem.config.js"

pm2 save

pm2 startup -u root --hp /root

echo "Deployment completed!"
echo "Check status: pm2 status"
echo "View logs: pm2 logs kocao"
echo "API running at: http://localhost:8000"