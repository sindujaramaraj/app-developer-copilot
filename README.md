# App Developer Copilot

A VS Code extension that helps you create react-native mobile applications using Copilot. This is a preview version of the extension and works better with Claude models.

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
6. Use "/design" command to generate a detailed roadmap or build plan
7. Use "/build" command to build the application
8. Use "/deploy" command to deploy the application
9. The extension will:
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

## Commands

- `create` - Create a new mobile application
- `run` - Run the generated application
- `design` - Generate a detailed roadmap or build plan
- `build` - Build the application
- `deploy` - Deploy the application

## Extension Development

Built with:

- TypeScript
- VS Code Extension API
- Webpack for bundling
- Jest for testing

## Issues & Suggestions

Please feel free to open issues and suggest features or pull requests on [Github](https://github.com/sindujaramaraj/app-developer-copilot).
