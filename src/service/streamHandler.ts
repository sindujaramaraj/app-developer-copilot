import * as vscode from 'vscode';

interface IStreamHanlderServiceInput {
  useChatStream: boolean;
  chatStream?: vscode.ChatResponseStream;
  outputChannel?: vscode.OutputChannel;
}

export class StreamHandlerService {
  private useChatStream: boolean = false;
  // Use chat stream when used copilot chat
  private chatStream: vscode.ChatResponseStream | undefined;
  // Use status bar for progress when invoked from command palette
  private statusBarItem: vscode.StatusBarItem | undefined;

  private outputChannel: vscode.OutputChannel | undefined;

  constructor({
    useChatStream,
    chatStream,
    outputChannel,
  }: IStreamHanlderServiceInput) {
    this.useChatStream = useChatStream;
    this.chatStream = chatStream;
    this.outputChannel = outputChannel;
    if (!this.useChatStream) {
      this.statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100,
      );
      this.statusBarItem.show();
    }
  }

  progress(text: string): void {
    if (this.useChatStream && this.chatStream) {
      this.chatStream.progress(text);
    } else if (this.statusBarItem) {
      this.statusBarItem.text = text;
      this.outputChannel?.show();
      this.outputChannel?.appendLine(text);
    } else {
      console.trace(text);
    }
  }

  message(text: string): void {
    if (this.useChatStream && this.chatStream) {
      this.chatStream.markdown(text);
      this.chatStream.markdown('\n');
    } else if (this.statusBarItem) {
      this.statusBarItem.text = text;
      this.outputChannel?.show();
      this.outputChannel?.appendLine(text);
    } else {
      console.log(text);
    }
  }

  command(command: string, title?: string): void {
    title = title || `Run ${command}`;
    if (this.useChatStream && this.chatStream) {
      this.chatStream.button({
        title,
        command,
      });
    } else if (this.statusBarItem) {
      this.statusBarItem.command = {
        command,
        title,
      };
    } else {
      console.warn('Not able to run command:', command);
    }
  }

  close(): void {
    if (this.useChatStream && this.chatStream) {
      // do nothing
    } else if (this.statusBarItem) {
      this.statusBarItem.dispose();
      this.statusBarItem.hide();
    }
  }
}
