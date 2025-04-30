import React from 'react';
import { createRoot } from 'react-dom/client';
import BackendConfig from './components/BackendConfig';
import {
  getDefaultMobileTechStack,
  IMobileTechStackOptions,
  StateManagement,
  Storage,
  UILibrary,
} from '../builder/mobile/mobileTechStack';
import { IBackendConfig } from '../builder/backend/serviceStack';

// Declare acquireVsCodeApi as a global function provided by VS Code
declare function acquireVsCodeApi(): any;

function MobileTechStackView() {
  const [stack, setStack] = React.useState<IMobileTechStackOptions>(
    getDefaultMobileTechStack(),
  );

  const onChangeBackendConfig = React.useCallback((config: IBackendConfig) => {
    setStack((prevStack) => ({
      ...prevStack,
      backendConfig: {
        ...prevStack.backendConfig,
        ...config,
      },
    }));
  }, []);

  const handleSubmit = React.useCallback(() => {
    const vscode = acquireVsCodeApi();
    vscode.postMessage({ type: 'submit', options: stack });
  }, [stack]);

  return (
    <div>
      <h1>Configure Mobile Tech Stack</h1>
      <div>
        <label>State Management:</label>
        <select
          id="stateManagement"
          value={stack.stateManagement}
          onChange={(e) =>
            setStack((prevStack) => ({
              ...prevStack,
              stateManagement: e.target.value as StateManagement,
            }))
          }
        >
          {Object.values(StateManagement).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label>UI Library:</label>
        <select
          id="uiLibrary"
          value={stack.uiLibrary}
          onChange={(e) =>
            setStack((prevStack) => ({
              ...prevStack,
              uiLibrary: e.target.value as UILibrary,
            }))
          }
        >
          {Object.values(UILibrary).map((value) => (
            <option
              key={value}
              value={value}
              selected={stack.uiLibrary === value}
            >
              {value}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label>Storage:</label>
        <select
          id="storage"
          value={stack.storage}
          onChange={(e) =>
            setStack((prevStack) => ({
              ...prevStack,
              storage: e.target.value as Storage,
            }))
          }
        >
          {Object.values(Storage).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <BackendConfig
        config={stack.backendConfig}
        onChange={onChangeBackendConfig}
      />

      <div>
        <label htmlFor="figmaUrl">Figma URL (Optional):</label>
        <input
          type="text"
          id="figmaUrl"
          value={(stack.designConfig && stack.designConfig.figmaUrl) || ''}
          onChange={(e) =>
            setStack((prevStack) => ({
              ...prevStack,
              figmaUrl: e.target.value,
            }))
          }
          placeholder="https://www.figma.com/file/..."
        />
      </div>

      <div>
        <button id="techstack-button-submit" onClick={handleSubmit}>
          Done
        </button>
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Container element not found');
}
const root = createRoot(container);
root.render(<MobileTechStackView />);
