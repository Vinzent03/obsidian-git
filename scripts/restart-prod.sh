./scripts/0-prepare-start.sh prod &&
  docker-compose -f docker/compose.yml run --rm plugin-build-for-prod

# Then open the test-vault in obsidian
