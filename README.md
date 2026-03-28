# Reel — Dating App (React Native / Expo)

A video-first dating app with TikTok-style swiping, built with React Native and Expo.

## Features
- **Discover** — Full-screen swipeable profile cards with video & photo badges, LIKE/NOPE stamps
- **Matches** — Grid view of matched profiles with NEW indicators
- **Messages** — Conversation list with online indicators and unread badges
- **Profile** — Your own profile with stats, video upload CTA, bio & interests

## Project Structure
```
reel-app/
├── App.js                        # Root entry point
├── app.json                      # Expo config
├── src/
│   ├── theme.js                  # Colors, fonts, spacing
│   ├── data/
│   │   └── mockData.js           # Profiles, matches, conversations
│   ├── components/
│   │   └── SwipeCard.js          # Swipeable profile card (gesture + animation)
│   ├── screens/
│   │   ├── DiscoverScreen.js     # Main swipe screen + match modal
│   │   ├── MatchesScreen.js      # Matches grid
│   │   ├── MessagesScreen.js     # Conversation list
│   │   └── ProfileScreen.js      # Own profile
│   └── navigation/
│       └── TabNavigator.js       # Bottom tab navigation
```

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Start the development server
```bash
npx expo start
```

### 3. Run on your device
- Install the **Expo Go** app on your iPhone or Android phone
- Scan the QR code from the terminal
- The app will load on your device instantly

### Or run on a simulator
```bash
npx expo start --ios       # requires Xcode on Mac
npx expo start --android   # requires Android Studio
```

## Next Steps to Build Out
- [ ] Real video recording & playback (expo-av is already installed)
- [ ] Firebase backend for real user profiles & matching
- [ ] Chat screen with real-time messaging
- [ ] Profile video upload flow
- [ ] Push notifications for matches & messages
- [ ] Location-based matching
- [ ] AI compatibility scoring

## Tech Stack
- **React Native** + **Expo** ~50
- **React Navigation** v6 (bottom tabs)
- **expo-av** for video playback
- **expo-linear-gradient** for UI gradients
- **react-native-reanimated** + **react-native-gesture-handler** for swipe gestures
