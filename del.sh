#!/bin/bash

echo "🚫 Stopping all running containers..."
docker ps -q | xargs -r docker stop

echo "🗑 Removing all containers..."
docker ps -aq | xargs -r docker rm

echo "🧹 Removing all images..."
docker images -q | xargs -r docker rmi -f

echo "🧺 Removing all volumes..."
docker volume ls -q | xargs -r docker volume rm

echo "🌐 Removing all user-defined networks..."
# Do not remove default networks (bridge, host, none)
docker network ls | grep -vE 'bridge|host|none' | awk '{print $1}' | xargs -r docker network rm

echo "🧼 Running system prune to clean up leftovers..."
docker system prune -af --volumes

echo "✅ Docker cleanup completed!"
