# Icon Generation Instructions

## Source Icon
The source icon is at `/public/icon.svg`

## Required Icon Sizes for PWA & App Store

### PWA Icons (Required)
Generate PNG files at these sizes from the SVG:
- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png
- icon-384x384.png
- icon-512x512.png

### Apple App Store (Required for iOS app)
- 1024x1024.png (App Store listing)
- 180x180.png (iPhone @3x)
- 167x167.png (iPad Pro @2x)
- 152x152.png (iPad @2x)
- 120x120.png (iPhone @2x)

### Google Play Store (Required for Android app)
- 512x512.png (Hi-res icon)
- 192x192.png (Launcher icon)

## How to Generate

### Option 1: Online Tool (Easiest)
1. Go to https://realfavicongenerator.net/
2. Upload the icon.svg file
3. Download the generated icon pack
4. Place files in this /icons folder

### Option 2: Command Line (macOS)
```bash
# Install ImageMagick if needed
brew install imagemagick

# Generate all sizes
cd public
for size in 72 96 128 144 152 180 192 384 512 1024; do
  magick icon.svg -resize ${size}x${size} icons/icon-${size}x${size}.png
done
```

### Option 3: Figma/Sketch
1. Import icon.svg
2. Export at each required size

## Screenshots (for App Store)

Place screenshots in /public/screenshots/:
- desktop.png (1280x720 or larger)
- mobile.png (390x844 for iPhone 14 Pro)

Take screenshots of the app in action showing:
1. Landing page
2. Quiz creation
3. Taking a quiz
4. Results/analytics
