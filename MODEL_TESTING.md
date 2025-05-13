# Code generation notes for model testing

## Open AI

### o1 mini

- Open router mini model sometimes couldn't respond
- Copilot model responded but content is not escaped

### OpenAI GPT-4o

- Created the complete app with bugs but not following expo router file paths

## Anthropic

### Claude 3.5 Sonnet

- Created the complete app with bugs and correct file paths

### Claude 3.5 Haiku

- Erroring out with `AI_APICallError: Bad Request`

Claude model needs the tool references intially passed but works with auto
gpt 4.1 needs the tool references intially passed but works with auto

- generates shandcn components that are already installed

Gemini model - remove tool after use and doesnt call tool in auto mode
