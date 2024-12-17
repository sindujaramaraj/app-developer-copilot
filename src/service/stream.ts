import * as vscode from 'vscode';

export class StreamService {
  private useChatStream: boolean = false;
  private chatStream: vscode.ChatResponseStream | undefined;
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

  progress(message: string): void {
    if (this.useChatStream && this.chatStream) {
      this.chatStream.progress(message);
    } else if (this.statusBarItem) {
      this.statusBarItem.text = message;
    } else {
      console.trace(message);
    }
  }

  markdown(message: string): void {
    if (this.useChatStream && this.chatStream) {
      this.chatStream.markdown(message);
    } else if (this.statusBarItem) {
      this.statusBarItem.tooltip = message;
    } else {
      console.log(message);
    }
  }
}
