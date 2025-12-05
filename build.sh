#!/bin/bash

# Build script for Zoom For Education v1 Moodle Plugin
# This script builds the React frontend and prepares it for deployment

set -e  # Exit on error

echo "🔨 Building Zoom For Education Frontend..."
echo ""

# Check if frontend directory exists
if [ ! -d "frontend" ]; then
    echo "❌ Error: frontend directory not found"
    exit 1
fi

# Navigate to frontend directory
cd frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Build the application
echo "🏗️  Building React application..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build completed successfully!"
    echo ""
    echo "📁 Output directory: zoomforeducationv1/ui/"
    echo ""
    echo "Next steps:"
    echo "  1. Review the changes in zoomforeducationv1/ui/"
    echo "  2. Test the application in your Moodle instance"
    echo "  3. Commit the changes: git add zoomforeducationv1/ui/ && git commit -m 'Update frontend build'"
    echo ""
else
    echo ""
    echo "❌ Build failed!"
    exit 1
fi

