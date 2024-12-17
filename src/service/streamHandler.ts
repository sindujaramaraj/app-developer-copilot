import * as vscode from 'vscode';

export class StreamHandlerService {
  private useChatStream: boolean = false;
  // Use chat stream when used copilot chat
  private chatStream: vscode.ChatResponseStream | undefined;
  // Use status bar for progress when invoked from command palette
  private statusBarItem: vscode.StatusBarItem | undefined;

  constructor(useChatStream: boolean, chatStream?: vscode.ChatResponseStream) {
    this.useChatStream = useChatStream;
    this.chatStream = chatStream;
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
    } else {
      console.trace(text);
    }
  }

  message(text: string): void {
    if (this.useChatStream && this.chatStream) {
      this.chatStream.markdown(text);
    } else if (this.statusBarItem) {
      this.statusBarItem.tooltip = text;
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
}
