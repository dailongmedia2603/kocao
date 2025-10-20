UPLOAD_DIR="uploads"

echo "Clearing uploads directory..."

if [ -d "$UPLOAD_DIR" ]; then
    rm -rf "$UPLOAD_DIR"/*
    
    if [ $? -eq 0 ]; then
        echo "Successfully cleared all files in $UPLOAD_DIR/"
        echo "Current status:"
        ls -lah "$UPLOAD_DIR" 2>/dev/null || echo "   (empty)"
    else
        echo "Error clearing files"
        exit 1
    fi
else
    echo "Directory $UPLOAD_DIR does not exist"
    echo "Creating $UPLOAD_DIR directory..."
    mkdir -p "$UPLOAD_DIR"
    echo "Created $UPLOAD_DIR/"
fi

echo ""
echo "Done!"

