# App Developer Copilot

A VS Code extension that helps you create react-native mobile applications using Copilot.

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

1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Type "App Developer Mobile"
3. Select the chat participant and provide your app requirements
4. The extension will:
   - Generate app architecture diagram
   - Create an Expo project
   - Generate component code
   - Install required dependencies

## Chat Participants

- Mobile App Developer(`@app-developer-mobile`)

## Commands

- `create` - Create a new mobile application
- `run` - Run the generated application

## Extension Development

Built with:

- TypeScript
- VS Code Extension API
- Webpack for bundling
- Jest for testing
