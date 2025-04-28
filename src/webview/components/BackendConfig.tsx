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
      {config.backend === Backend.SUPABASE && (
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
      )}
      {config.useExisting && config.backend === Backend.CUSTOM && (
        <div>
          <h6>Custom Backend Configuration</h6>
          <div>
            <label>GitHub Token:</label>
            <input
              type="text"
              id="githubToken"
              value={config.githubToken}
              onChange={(e) => {
                onChange({ ...config, githubToken: e.target.value });
              }}
            />
          </div>
          <div>
            <label>GitHub Repo Link:</label>
            <input
              type="text"
              id="githubRepoLink"
              value={config.githubRepoLink}
              onChange={(e) => {
                onChange({ ...config, githubRepoLink: e.target.value });
              }}
            />
          </div>
        </div>
      )}

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
