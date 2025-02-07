# Change Log

## [1.0.3] - 2025-02-07

### Added

- Option to choose tech stack
- Save prompts in conversation.json

### Changed

- Updated prompts for dependency components and asset creation
- Updated appdev.json with tech stack data and improved readability

## [1.0.2] - 2025-02-02

### Changed

- Updated prompts for dependency components to fix bugs in imports
- Benchmark - can generate simple notes and voice notes app wtihout any issues

## [1.0.1] - 2025-01-09

### Added

- Help command and redirection to commands on generic flow

### Changed

- Few telemetry fixes

## [1.0.0] - 2025-01-06

### Added

- Added support for telemetry

### Changed

- Moving to public beta

## [0.0.6] - 2024-12-18

### Changed

- Downgraded vscode version to 1.93.1 to support cursor

## [0.0.5] - 2024-12-18

### Added

- Added support for BYOK(Bring Your Own Key)
- Using Vercel AI SDK to support Anthropic, OpenAI and OpenRouter models
- Ability to configure the model and API key for the AI models through settings

### Changed

- Updated appdev.json with model and model provider data
- Switched to Zod for schema validation and removed dependency on Joi

## [0.0.4] - 2024-12-12

### Changed

- Updated appdev.json with generated features and components design
- Updated progress texts during code generation

### Fixed

- Use a single terminal for all commands

## [0.0.3] - 2024-12-04

## [0.0.2] - 2024-12-04

## [0.0.1] - 2024-12-04

- Initial release
- Chat participant `@app-developer-mobile` for mobile app development
- `/create` command to generate new mobile applications
- `/run` command to start the generated application
- Support for Expo and React Native app generation
- Integration with expo-router for navigation
- Component-based code generation with dependencies
