#!/bin/bash
set -e

echo "Building Shellius..."

# Build Go backend
echo "Building backend..."
cd backend
GOOS=darwin GOARCH=amd64 go build -o ../dist/shellius-backend-darwin-amd64 ./cmd/shellius
GOOS=linux GOARCH=amd64 go build -o ../dist/shellius-backend-linux-amd64 ./cmd/shellius
GOOS=windows GOARCH=amd64 go build -o ../dist/shellius-backend-windows-amd64.exe ./cmd/shellius
cd ..

# Build Go cloud server
echo "Building cloud server..."
cd cloud
GOOS=linux GOARCH=amd64 go build -o ../dist/shellius-cloud-linux-amd64 ./cmd/server
cd ..

# Build frontend + Electron
echo "Building frontend..."
cd frontend
npm run electron:build
cd ..

echo "Build complete. Output in dist/"
