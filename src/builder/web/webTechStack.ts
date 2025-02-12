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
  CONTEXT = 'context',
}

export enum UILibrary {
  MATERIAL_UI = '@mui/material',
  CHAKRA = '@chakra-ui/react',
  TAILWIND = 'tailwindcss',
  SHADCN = 'shadcn-ui',
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

export const getWebAppCreationCommand = (
  stack: WebTechStackOptions,
  appName: string,
): string => {
  switch (stack.framework) {
    case WebFramework.NEXT:
      return `npx create-next-app@latest ${appName} --eslint --src-dir --tailwind --ts --app --turbopack --import-alias '@/*'`;
  }
};

export const getLibsToInstallForStack = (
  _stack: WebTechStackOptions,
): string[] => {
  const libs = [];
  // TODO: Add libraries
  libs.push('react', 'react-dom');
  return libs;
};

export const getPromptForStack = (stack: WebTechStackOptions): string => {
  let prompt = `Create a web app using ${stack.framework} with the following tech stack:\
  State Management: ${stack.stateManagement}\
  UI Library: ${stack.uiLibrary}\
  Data Fetching: ${stack.dataFetching}\
  Styling: ${stack.styling}\
  Build Tool: ${stack.buildTool}
  `;
  return prompt;
};
