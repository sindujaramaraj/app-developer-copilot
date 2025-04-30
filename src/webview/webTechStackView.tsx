import React from 'react';
import { createRoot } from 'react-dom/client';
import BackendConfig from './components/BackendConfig';
import {
  BuildTools,
  getDefaultWebTechStack,
  StateManagement,
  Styling,
  UILibrary,
  IWebTechStackOptions,
} from '../builder/web/webTechStack';
import { IBackendConfig } from '../builder/backend/serviceStack';

declare function acquireVsCodeApi(): any;

function WebTechStackView() {
  const [stack, setStack] = React.useState<IWebTechStackOptions>(
    getDefaultWebTechStack(),
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
      <h3>Configure Tech Stack</h3>

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
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label>Styling:</label>
        <select
          id="styling"
          value={stack.styling}
          onChange={(e) =>
            setStack((prevStack) => ({
              ...prevStack,
              styling: e.target.value as Styling,
            }))
          }
        >
          {Object.values(Styling).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label>Build Tool:</label>
        <select
          id="buildTool"
          value={stack.buildTool}
          onChange={(e) =>
            setStack((prevStack) => ({
              ...prevStack,
              buildTool: e.target.value as BuildTools,
            }))
          }
        >
          {Object.values(BuildTools).map((value) => (
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
              designConfig: {
                ...prevStack.designConfig,
                figmaUrl: e.target.value,
              },
            }))
          }
          placeholder="https://www.figma.com/file/..."
        />
      </div>

      <button id="techstack-button-submit" onClick={handleSubmit}>
        Done
      </button>
    </div>
  );
}

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Container element not found');
}
const root = createRoot(container);
root.render(<WebTechStackView />);
