import * as vscode from 'vscode';
import * as path from 'path';
import {
  extractCodeFromMarkdown,
  isCodeBlock,
  processMediaFile,
} from './contentUtil';

interface ParsedFile {
  path: string;
  content: string;
}

export interface IFile {
  path: string;
  content: string;
}

export class FileParser {
  /**
   * Create or replace files in the workspace based on the response
   * @param files List of files to create/replace
   * @param pathPrefix Files must be prefixed with this path
   * @param baseDir
   */
  static async parseAndCreateFiles(
    files: IFile[],
    pathPrefix: string,
    isMedia?: boolean,
    baseDir?: string,
  ): Promise<void> {
    // Get workspace directory if not provided
    if (!baseDir) {
      const workspaceFolder = await FileParser.getWorkspaceFolder();
      if (!workspaceFolder) {
        throw new Error('No workspace folder selected');
      }
      baseDir = workspaceFolder;
    }

    // Create files
    for (const file of files) {
      // check if file path is prefixed with pathPrefix
      if (!file.path.startsWith(pathPrefix)) {
        const newPath = path.join(pathPrefix, file.path);
        console.info(`Converting ${file.path} to ${newPath}`);
        file.path = newPath;
      }
      await FileParser.createFile(baseDir, file, isMedia);
    }
  }

  static async getWorkspaceFolder(): Promise<string | undefined> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders) {
      const selected = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        title: 'Select folder for generated files',
      });
      return selected?.[0].fsPath;
    }

    if (workspaceFolders.length === 1) {
      return workspaceFolders[0].uri.fsPath;
    }

    const selected = await vscode.window.showQuickPick(
      workspaceFolders.map((folder) => ({
        label: folder.name,
        uri: folder.uri,
      })),
      { placeHolder: 'Select workspace folder' },
    );

    return selected?.uri.fsPath;
  }

  private static async createFile(
    baseDir: string,
    file: ParsedFile,
    isMedia?: boolean,
  ): Promise<void> {
    const fullPath = path.join(baseDir, file.path);

    // Create directory if it doesn't exist
    const dirPath = path.dirname(fullPath);
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirPath));
    console.info(`Created directory: ${dirPath}`);

    // Create file
    const uri = vscode.Uri.file(fullPath);

    if (isMedia) {
      try {
        const content = processMediaFile(file.content);
        // Write the file
        await vscode.workspace.fs.writeFile(uri, content);
      } catch (error) {
        console.error(`Failed to create media file: ${file.path}`);
        console.error(error);
        console.info('Creating empty file instead');
        // creating a empty file
        await vscode.workspace.fs.writeFile(uri, new Uint8Array());
      }
    } else {
      // check if the file content is a markdown
      let fileContent = file.content;
      if (isCodeBlock(file.content)) {
        fileContent = extractCodeFromMarkdown(file.content);
      }
      if (!fileContent) {
        console.error(`No content found for file: ${file.path}`);
      }
      const content = new TextEncoder().encode(file.content);

      await vscode.workspace.fs.writeFile(uri, content);

      // Open the file
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { preview: false });

      // Format document if possible
      try {
        await vscode.commands.executeCommand('editor.action.formatDocument');
      } catch (error) {
        // Ignore formatting errors
      } finally {
        // Save file
        await doc.save();
      }
    }

    console.info(`Created file: ${fullPath}`);
  }

  static async readFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      vscode.workspace.fs.readFile(vscode.Uri.file(filePath)).then(
        (data) => {
          const content = new TextDecoder().decode(data);
          resolve(content);
        },
        (error) => {
          reject(error);
        },
      );
    });
  }
}
