#!/bin/bash

# Start a local NATS server using Docker
echo "Starting local NATS server..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker to run the local NATS server."
    exit 1
fi

# Check if the NATS container is already running
if docker ps | grep -q nats-server; then
    echo "NATS server is already running."
else
    # Start the NATS server
    docker run -d --name nats-server -p 4222:4222 -p 8222:8222 nats:latest
    echo "NATS server started on port 4222."
fi

# Print the NATS server URL
echo "NATS server URL: nats://localhost:4222"