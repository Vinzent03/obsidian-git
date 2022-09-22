#!/bin/bash
set -e

./scripts/1-stop.sh

docker-compose -f docker/compose.yml build
