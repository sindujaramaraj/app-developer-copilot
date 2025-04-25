import * as React from 'react';
import { ENABLE_BACKEND } from '../../builder/constants';
import {
  AuthenticationMethod,
  Backend,
  IBackendConfig,
} from '../../builder/backend/serviceStack';

interface IBackendConfigProps {
  config: IBackendConfig;
  onChange: (config: IBackendConfig) => void;
}

export default function BackendConfig({
  config,
  onChange,
}: IBackendConfigProps) {
  if (!ENABLE_BACKEND) {
    return null;
  }

  return (
    <div>
      <div>
        <label>Backend:</label>
        <select
          id="backend"
          value={config.backend}
          onChange={(e) => {
            onChange({ ...config, backend: e.target.value as Backend });
          }}
        >
          {Object.values(Backend).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <div>
        <input
          type="checkbox"
          id="useExistingBackend"
          checked={config.useExisting}
          onChange={(e) => {
            const useExisting = e.target.checked;
            onChange({ ...config, useExisting });
          }}
        />
        <label htmlFor="useExistingBackend">Use Existing Backend</label>
      </div>

      <AuthConfig {...config} />
    </div>
  );
}

function AuthConfig(config: IBackendConfig) {
  return (
    <div>
      <label>Authentication: Experimental</label>
      <select id="authentication">
        {Object.values(AuthenticationMethod).map((value) => (
          <option value={value} selected={config.authentication === value}>
            {value}
          </option>
        ))}
      </select>
    </div>
  );
}
