import { FileUtil } from '../../utils/fileUtil';

export async function createSupaFiles(
  envFileContent: string,
  typesFilePath: string,
  supabaseTypes: string,
  folderName: string,
): Promise<void> {
  await FileUtil.parseAndCreateFiles(
    [
      {
        path: typesFilePath,
        content: supabaseTypes,
      },
      {
        path: '.env.local',
        content: envFileContent,
      },
    ],
    folderName,
  );
}
