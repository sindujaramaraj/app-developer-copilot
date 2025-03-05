import { IGenericStack } from '../types';

export enum WebFramework {
  NEXT = 'next',
  // REMIX = 'remix',
  // GATSBY = 'gatsby',
}

export enum StateManagement {
  REDUX = 'redux',
  ZUSTAND = 'zustand',
  JOTAI = 'jotai',
  RECOIL = 'recoil',
}

export enum UILibrary {
  MATERIAL_UI = '@mui/material',
  CHAKRA = '@chakra-ui/react',
  TAILWIND = 'tailwindcss',
  SHADCN = 'shadcn',
  RADIX = '@radix-ui/react',
}

export enum DataFetching {
  REACT_QUERY = '@tanstack/react-query',
  APOLLO = '@apollo/client',
  RTK_QUERY = '@reduxjs/toolkit/query',
  SWR = 'swr',
  AXIOS = 'axios',
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

export interface WebTechStackOptions extends IGenericStack {
  framework: WebFramework;
  stateManagement: StateManagement;
  uiLibrary: UILibrary;
  dataFetching?: DataFetching;
  testing: Testing[];
  styling: Styling;
  buildTool: BuildTools;
}

export const DEFAULT_WEB_STACK: WebTechStackOptions = {
  framework: WebFramework.NEXT,
  stateManagement: StateManagement.ZUSTAND,
  uiLibrary: UILibrary.SHADCN,
  dataFetching: DataFetching.REACT_QUERY,
  testing: [Testing.JEST, Testing.TESTING_LIBRARY],
  styling: Styling.TAILWIND,
  buildTool: BuildTools.TURBOPACK,
};

export const getDefaultWebTechStack = (): WebTechStackOptions => {
  return DEFAULT_WEB_STACK;
};

export const getWebAppCreationCommands = (
  stack: WebTechStackOptions,
  appName: string,
): string[] => {
  const commands = [];
  switch (stack.framework) {
    case WebFramework.NEXT:
      commands.push(
        `npx create-next-app@latest ${appName} --eslint --src-dir --tailwind --ts --app --turbopack --import-alias '@/*'`,
      );
      break;
  }
  switch (stack.uiLibrary) {
    case UILibrary.SHADCN:
      commands.push(`cd ${appName}`);
      commands.push('npx shadcn@latest init --yes -d'); // init shadcn
      commands.push('npx shadcn@latest add --all'); // add all components
      break;
  }
  return commands;
};

export const getLibsToInstallForStack = (
  stack: WebTechStackOptions,
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
  return libs;
};

export const getPromptForStack = (stack: WebTechStackOptions): string => {
  let prompt = `Use ${stack.framework} for the web app framework,
  ${stack.uiLibrary} for UI component library,\
  ${stack.stateManagement} for state management,\
  ${stack.styling} for styling,\
  and ${stack.buildTool} for build tool.
  `;
  return prompt;
};
