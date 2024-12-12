# App Developer Copilot

A VS Code extension that helps you create react-native mobile applications using Copilot. This is a preview version of the extension and works better with Claude models.

## How it works

The extension is developed to act like a real world application developer. Given a task, it will first anayse and design the app with features and components. It then through a series of prompts, generates code for the entire app.
Advantage of this approach is, app generated will have lot more features and functionality at the first go instead of having to update the minimal app generated with lot of prompts.

## Features

- Create mobile apps using React Native and Expo
- Generate application architecture and component designs
- Automatically generate TypeScript code for components
- Handle project setup and dependency management
- Uses expo-router for navigation and react-native-paper for theming

## Requirements

- Node.js v16.0.0 or higher
- Visual Studio Code 1.95.0 or higher

## Usage

1. Open copilot chat window
2. Select Claude model
3. Type "@app-developer-mobile" to start a chat with the extension
4. Use "/create" command to create a new mobile application
5. Use "/run" command to run the generated application
6. The extension will:
   - Generate app architecture diagram
   - Create an Expo project
   - Generate component code
   - Install required dependencies

Once the app is generated, you can run the app using the Expo Go app on your mobile device or an emulator.
Please note: There might be issues after app generation. You can manually fix them by following the error messages in the terminal.

## Disclaimer

This extension is still in development and may not work as expected. Please report any issues or suggestions on [Github](https://github.com/sindujaramaraj/app-developer-copilot).

## Chat Participants

- Mobile App Developer(`@app-developer-mobile`)

### Sample Prompts

`@app-developer-mobile /create A simple notes app`

`@app-developer-mobile /create Spelling bee app to generate words for kids K-5. Generate a service using anthropic client SDK to generate words based on grade selection`

`@app-developer-mobile /create flappy bird game`

## Commands

- `create` - Create a new mobile application
- `run` - Run the generated application

## Extension Development

Built with:

- TypeScript
- VS Code Extension API
- Webpack for bundling
- Jest for testing

## Development Setup

1. Fork and clone the repository
2. Install dependencies:

```bash
npm install
```

## Publishing Extension

### Install vsce

```bash
npm install -g vsce
```

### Package extension

```bash
vsce package
```

### Publish to marketplace

```bash
vsce publish --pre-release
```

## Issues & Suggestions

Please feel free to open issues and suggest features or pull requests on [Github](https://github.com/sindujaramaraj/app-developer-copilot).
