import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface NodeVersionCheck {
  installed: boolean;
  version?: string;
  error?: string;
  meetsMinimum: boolean;
}

export async function checkNodeInstallation(
  minVersion: string = '16.0.0',
): Promise<NodeVersionCheck> {
  try {
    // Check node version
    const { stdout } = await execAsync('node --version');
    const version = stdout.trim().replace('v', '');

    // Compare versions
    const meetsMinimum = compareVersions(version, minVersion) >= 0;

    return {
      installed: true,
      version,
      meetsMinimum,
    };
  } catch (error: any) {
    return {
      installed: false,
      error: error && error.message ? error.message : error,
      meetsMinimum: false,
    };
  }
}

function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if (partsA[i] > partsB[i]) return 1;
    if (partsA[i] < partsB[i]) return -1;
  }
  return 0;
}
