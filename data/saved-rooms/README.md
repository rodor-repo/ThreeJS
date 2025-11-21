# Saved Rooms Storage

This directory contains locally saved room configurations as JSON files.

## File Structure

Each saved room is stored as a separate JSON file:
- Format: `{roomId}.json`
- Location: `data/saved-rooms/`

## File Format

Each JSON file contains a complete `SavedRoom` object with:
- Room metadata (id, name, category, savedAt)
- Wall settings (height, length, color)
- Cabinet configurations
- View configurations

## Migration to Firebase

When ready to migrate to Firebase:
1. See `src/scripts/migrateToFirebase.ts` for migration script
2. Follow the instructions in the script comments
3. Update your code to use Firebase service layer instead of file storage

## Git Configuration

By default, saved room files are tracked in git. If you want to ignore them:
1. Uncomment the line in `.gitignore`: `/data/saved-rooms/*.json`
2. This is useful if rooms contain user-specific or sensitive data

