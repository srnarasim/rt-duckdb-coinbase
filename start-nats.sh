#!/bin/bash

# Start a local NATS server using Docker
echo "Starting local NATS server..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Checking for local NATS server..."
    
    # Check if nats-server is installed
    if command -v nats-server &> /dev/null; then
        echo "Found local nats-server. Starting..."
        nats-server -p 4222 -m 8222 &
        echo "NATS server started on port 4222."
    else
        echo "Neither Docker nor nats-server is installed."
        echo "Will use the demo NATS server at nats://demo.nats.io:4222 instead."
        export NEX_URL="nats://demo.nats.io:4222"
        return 0
    fi
else
    # Check if the NATS container is already running
    if docker ps | grep -q nats-server; then
        echo "NATS server container is already running."
    else
        # Check if the container exists but is stopped
        if docker ps -a | grep -q nats-server; then
            echo "Starting existing NATS server container..."
            docker start nats-server
        else
            # Start a new NATS server container
            echo "Creating and starting new NATS server container..."
            docker run -d --name nats-server -p 4222:4222 -p 8222:8222 nats:latest
        fi
        echo "NATS server started on port 4222."
    fi
fi

# Print the NATS server URL
echo "NATS server URL: nats://localhost:4222"