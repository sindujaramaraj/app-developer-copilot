import { Backend } from '../backend/serviceStack';
import { IGenericStack } from '../types';

export enum MobileFramework {
  REACT_NATIVE = 'react-native',
  FLUTTER = 'flutter',
}

export enum StateManagement {
  REDUX = 'redux',
  ZUSTAND = 'zustand',
  MOBX = 'mobx',
  RECOIL = 'recoil',
  JOTAI = 'jotai',
}

export enum UILibrary {
  REACT_NATIVE_PAPER = 'react-native-paper',
  NATIVE_BASE = 'native-base',
  TAMAGUI = 'tamagui',
  RESTYLE = '@shopify/restyle',
}

export enum Navigation {
  EXPO_ROUTER = 'expo-router',
  REACT_NAVIGATION = '@react-navigation/native',
}

export enum DataFetching {
  REACT_QUERY = '@tanstack/react-query',
  APOLLO = '@apollo/client',
  RTK_QUERY = '@reduxjs/toolkit/query',
  SWR = 'swr',
}

export enum Testing {
  JEST = 'jest',
  TESTING_LIBRARY = '@testing-library/react-native',
  DETOX = 'detox',
}

export enum Storage {
  ASYNC_STORAGE = '@react-native-async-storage/async-storage',
  MMKV = 'react-native-mmkv',
  REALM = '@realm/react',
}

export enum Authentication {
  None = 'none',
  EXPO_AUTH = 'expo-auth-session',
  FIREBASE = '@react-native-firebase/auth',
  CLERK = '@clerk/clerk-expo',
  SUPABASE = '@supabase/supabase-js',
}

export interface IMobileTechStackOptions extends IGenericStack {
  framework: MobileFramework;
  stateManagement: StateManagement;
  uiLibrary: UILibrary;
  navigation: Navigation;
  dataFetching?: DataFetching;
  testing: Testing[];
  storage: Storage;
  authentication: Authentication;
}

export const DEFAULT_MOBILE_STACK: IMobileTechStackOptions = {
  framework: MobileFramework.REACT_NATIVE,
  stateManagement: StateManagement.ZUSTAND,
  uiLibrary: UILibrary.REACT_NATIVE_PAPER,
  dataFetching: DataFetching.REACT_QUERY,
  navigation: Navigation.EXPO_ROUTER,
  testing: [Testing.JEST, Testing.TESTING_LIBRARY],
  storage: Storage.ASYNC_STORAGE,
  authentication: Authentication.None,
  backend: Backend.None,
};

export const getDefaultMobileTechStack = (): IMobileTechStackOptions => {
  return DEFAULT_MOBILE_STACK;
};

export const getLibsToInstallForStack = (
  stack: IMobileTechStackOptions,
): string[] => {
  const libs = [];
  switch (stack.stateManagement) {
    case StateManagement.REDUX:
      libs.push('redux', 'react-redux');
      break;
    case StateManagement.ZUSTAND:
      libs.push('zustand');
      break;
    case StateManagement.MOBX:
      libs.push('mobx', 'mobx-react-lite');
      break;
    case StateManagement.RECOIL:
      libs.push('recoil');
      break;
    case StateManagement.JOTAI:
      libs.push('jotai');
      break;
  }

  switch (stack.uiLibrary) {
    case UILibrary.REACT_NATIVE_PAPER:
      libs.push('react-native-paper');
      break;
    case UILibrary.NATIVE_BASE:
      libs.push('native-base');
      libs.push('normalize-css-color');
      break;
    case UILibrary.TAMAGUI:
      libs.push('tamagui');
      libs.push('@tamagui/themes');
      break;
    case UILibrary.RESTYLE:
      libs.push('@shopify/restyle');
      break;
  }

  switch (stack.navigation) {
    case Navigation.EXPO_ROUTER:
      libs.push('expo-router');
      break;
    case Navigation.REACT_NAVIGATION:
      libs.push('@react-navigation/native');
      break;
  }

  switch (stack.dataFetching) {
    case DataFetching.REACT_QUERY:
      libs.push('@tanstack/react-query');
      break;
    case DataFetching.APOLLO:
      libs.push('@apollo/client');
      break;
    case DataFetching.RTK_QUERY:
      libs.push('@reduxjs/toolkit/query');
      break;
    case DataFetching.SWR:
      libs.push('swr');
      break;
  }

  // TODO: Add testing libraries and authentication libraries

  return libs;
};

export const getPromptForMobileStack = (
  stack: IMobileTechStackOptions,
): string => {
  return `Use ${stack.stateManagement} for state management, ${stack.uiLibrary} for UI components library, \
   ${stack.navigation} for navigation, ${stack.dataFetching} for data fetching, \
   and ${stack.storage} for storage. \
   ${
     stack.authentication !== Authentication.None
       ? ` Use ${stack.authentication} for authentication.`
       : 'Do not add authentication.'
   }`;
};
