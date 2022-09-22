./scripts/0-prepare-start.sh dev &&
  docker-compose -f docker/compose.yml run --rm plugin-watchmode-for-dev

# Now open the test-vault in obsidian and work with it.
# Reload the plugins with Ctrl + Shift + I (Developer Mode) and
# then with Ctrl + Shift + R (reload Obsidian).
