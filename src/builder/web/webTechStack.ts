import {
  AuthenticationMethod,
  Backend,
  getPromptForBackend,
} from '../backend/serviceStack';
import { IGenericStack } from '../types';

export enum WebFramework {
  NEXT = 'next',
  REACT = 'react',
  // REMIX = 'remix',
  // GATSBY = 'gatsby',
}

export enum StateManagement {
  REDUX = 'redux',
  ZUSTAND = 'zustand',
  JOTAI = 'jotai',
  RECOIL = 'recoil',
  NONE = 'none',
}

export enum UILibrary {
  MATERIAL_UI = '@mui/material',
  CHAKRA = '@chakra-ui/react',
  SHADCN = 'shadcn',
}

export enum Testing {
  JEST = 'jest',
  VITEST = 'vitest',
  TESTING_LIBRARY = '@testing-library/react',
  CYPRESS = 'cypress',
  PLAYWRIGHT = '@playwright/test',
}

export enum Styling {
  STYLED_COMPONENTS = 'styled-components',
  EMOTION = '@emotion/react',
  TAILWIND = 'tailwindcss',
  CSS_MODULES = 'css-modules',
  SCSS = 'sass',
}

export enum BuildTools {
  WEBPACK = 'webpack',
  VITE = 'vite',
  TURBOPACK = '@vercel/turbopack',
  ROLLUP = 'rollup',
  SWC = '@swc/core',
}

export interface IWebTechStackOptions extends IGenericStack {
  framework: WebFramework;
  stateManagement: StateManagement;
  uiLibrary: UILibrary;
  testing: Testing[];
  styling: Styling;
  buildTool: BuildTools;
}

export const DEFAULT_WEB_STACK: IWebTechStackOptions = {
  framework: WebFramework.NEXT,
  stateManagement: StateManagement.ZUSTAND,
  uiLibrary: UILibrary.SHADCN,
  testing: [Testing.JEST, Testing.TESTING_LIBRARY],
  styling: Styling.TAILWIND,
  buildTool: BuildTools.TURBOPACK,
  backendConfig: {
    backend: Backend.SUPABASE,
    useExisting: false,
    authentication: AuthenticationMethod.EMAIL,
  },
  designConfig: {},
};

export const getDefaultWebTechStack = (): IWebTechStackOptions => {
  return DEFAULT_WEB_STACK;
};

export const getWebAppCreationCommands = (
  stack: IWebTechStackOptions,
  appName: string,
): string[] => {
  const commands = [];
  switch (stack.framework) {
    case WebFramework.REACT:
      commands.push(`npx create-react-app ${appName} --template typescript`);
      break;
    case WebFramework.NEXT:
      commands.push(
        `npx create-next-app@latest ${appName} --eslint --src-dir --tailwind --ts --app --turbopack --import-alias '@/*'`,
      );
      break;
  }
  switch (stack.uiLibrary) {
    case UILibrary.SHADCN:
      commands.push(`cd ${appName}`);
      commands.push(
        'npx shadcn@latest init --yes --defaults --base-color neutral',
      ); // init shadcn
      commands.push('npx shadcn@latest add --all'); // add all components
      break;
  }

  return commands;
};

export const getLibsToInstallForStack = (
  stack: IWebTechStackOptions,
): string[] => {
  const libs = [];
  switch (stack.stateManagement) {
    case StateManagement.REDUX:
      libs.push('react-redux');
      break;
    case StateManagement.ZUSTAND:
      libs.push('zustand');
      break;
    case StateManagement.JOTAI:
      libs.push('jotai');
      break;
    case StateManagement.RECOIL:
      libs.push('recoil');
      break;
  }

  switch (stack.uiLibrary) {
    case UILibrary.CHAKRA:
      libs.push('@chakra-ui/react');
      libs.push('@emotion/react');
      break;
    case UILibrary.MATERIAL_UI:
      libs.push('@mui/material');
      libs.push('@emotion/react');
      libs.push('@emotion/styled');
      libs.push('@fontsource/roboto');
      libs.push('@mui/icons-material');
      break;
  }
  const { backend } = stack.backendConfig;

  switch (backend) {
    case Backend.SUPABASE:
      libs.push('@supabase/ssr');
      libs.push('@supabase/supabase-js');
      break;
  }
  return libs;
};

export const getPromptForWebStack = (stack: IWebTechStackOptions): string => {
  return `Use ${stack.framework} for the web app framework,
  ${stack.uiLibrary} for UI component library,\
  ${stack.stateManagement} for state management,\
  ${stack.styling} for styling,\
  and ${stack.buildTool} for build tool.\
  ${getPromptForBackend(stack.backendConfig)}
  `;
};

export function getBestPracticesPromptForWebFramework(
  framework: WebFramework,
): string {
  switch (framework) {
    case WebFramework.NEXT:
      return `Next.js is a React framework that enables functionality like server-side rendering and generating static sites.\
      Keep in mind the following best practices:\
      - Use server components for static content.\
      - Server components cannot use React hooks or client-side interactivity.\
      - Server components CAN import client components
      - Client components must have 'use client' directive at the top of the file.\
      - Client components can use React hooks and event handlers.\
      - Client components CANNOT import server components.\
      - Keep components server-side by default.\
      - Only use client components when absolutely necessary.\
      `;
    case WebFramework.REACT:
      return `React is a JavaScript library for building user interfaces`;
  }
}
